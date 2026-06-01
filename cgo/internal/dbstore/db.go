package dbstore

import (
	"database/sql"
	"fmt"
	"net/url"
	"runtime/cgo"
	"strings"

	polydb "github.com/nevaria-ai/polycode/cgo/internal/db"

	_ "modernc.org/sqlite"
)

// DB holds one SQLite connection and sqlc queries for it.
type DB struct {
	Conn *sql.DB
	Q    *polydb.Queries
}

// Open opens SQLite at path, runs migrations, and returns a handle for FFI.
func Open(path string) (cgo.Handle, error) {
	uri, err := SQLiteURI(path)
	if err != nil {
		return 0, err
	}

	conn, err := sql.Open("sqlite", uri)
	if err != nil {
		return 0, fmt.Errorf("open db: %w", err)
	}

	if err := tuneSQLite(conn, uri); err != nil {
		conn.Close()
		return 0, err
	}
	if err := conn.Ping(); err != nil {
		conn.Close()
		return 0, fmt.Errorf("ping db: %w", err)
	}
	if err := runMigrations(conn); err != nil {
		conn.Close()
		return 0, fmt.Errorf("migrate: %w", err)
	}

	store := &DB{
		Conn: conn,
		Q:    polydb.New(conn),
	}

	return cgo.NewHandle(store), nil
}

// FromHandle returns the DB for an FFI handle.
func FromHandle(h cgo.Handle) (*DB, error) {
	if h == 0 {
		return nil, fmt.Errorf("invalid db handle: %d", h)
	}
	defer func() {
		recover()
	}()
	store, ok := h.Value().(*DB)
	if !ok || store == nil {
		return nil, fmt.Errorf("invalid db handle: %d", h)
	}
	return store, nil
}

// Close closes the database for handle h and invalidates the handle.
func Close(h cgo.Handle) (err error) {
	if h == 0 {
		return fmt.Errorf("invalid db handle: %d", h)
	}
	ch := h
	defer func() {
		if recover() != nil {
			err = fmt.Errorf("invalid db handle: %d", h)
		}
	}()
	store, ok := ch.Value().(*DB)
	if !ok || store == nil {
		return fmt.Errorf("invalid db handle: %d", h)
	}
	errClose := store.Conn.Close()
	ch.Delete()
	return errClose
}

// SQLiteURI maps path to a SQLite connection URI (modernc.org/sqlite / database/sql).
//
// Accepted forms:
//   - ":memory:" — in-memory database (must be given explicitly)
//   - "file:…" — SQLite file URI (pass-through)
//   - "file:///…" — absolute file URL (pass-through)
//   - "/data/polycode.db" — bare filesystem path → file URI with create-if-missing
//
// An empty path is an error; in-memory is never implied.
func SQLiteURI(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", fmt.Errorf("database path is empty (use %q for in-memory)", ":memory:")
	}
	if isMemoryURI(path) {
		return path, nil
	}
	if strings.HasPrefix(path, "file:") {
		return path, nil
	}
	if u, err := url.Parse(path); err == nil && u.Scheme == "file" {
		return path, nil
	}
	return "file:" + path + "?mode=rwc", nil
}

// isMemoryURI reports whether uri refers to an in-memory SQLite database.
func isMemoryURI(uri string) bool {
	return strings.HasPrefix(uri, ":memory:") ||
		strings.Contains(uri, "mode=memory")
}

// tuneSQLite configures a single-user local SQLite workload: one connection,
// FK enforcement, lock retries, and WAL for file-backed databases.
func tuneSQLite(db *sql.DB, uri string) error {
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)

	stmts := []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 5000",
	}
	if !isMemoryURI(uri) {
		stmts = append(stmts,
			"PRAGMA journal_mode = WAL",
			"PRAGMA synchronous = NORMAL",
		)
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("%s: %w", stmt, err)
		}
	}
	return nil
}
