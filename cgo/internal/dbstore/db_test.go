package dbstore

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"runtime/cgo"
	"testing"

	polydb "github.com/nevaria-ai/polycode/cgo/internal/db"
)

func strPtr(s string) *string { return &s }

func openTestDB(t *testing.T, path string) (*DB, cgo.Handle) {
	t.Helper()

	h, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	db := h.Value().(*DB)
	t.Cleanup(func() { _ = Close(h) })
	return db, h
}

func TestSQLiteURI(t *testing.T) {
	_, err := SQLiteURI("")
	if err == nil {
		t.Fatal("expected error for empty path")
	}

	got, err := SQLiteURI(":memory:")
	if err != nil || !isMemoryURI(got) {
		t.Fatalf("memory: got %q err=%v", got, err)
	}

	got, err = SQLiteURI("/var/lib/polycode/polycode.db")
	if err != nil || got != "file:/var/lib/polycode/polycode.db?mode=rwc" {
		t.Fatalf("bare path: got %q err=%v", got, err)
	}

	got, err = SQLiteURI("file:///tmp/polycode.db?mode=rwc")
	if err != nil || got != "file:///tmp/polycode.db?mode=rwc" {
		t.Fatalf("file uri: got %q err=%v", got, err)
	}
}

func TestOpenDBEmptyPath(t *testing.T) {
	if _, err := Open(""); err == nil {
		t.Fatal("expected error for empty path")
	}
}

func TestCloseZeroHandle(t *testing.T) {
	if err := Close(0); err == nil {
		t.Fatal("expected error for handle 0")
	}
}

func TestMigrationsRecorded(t *testing.T) {
	db, _ := openTestDB(t, ":memory:")

	head, err := HeadVersion()
	if err != nil {
		t.Fatal(err)
	}

	var version int
	var dirty int
	err = db.Conn.QueryRow(
		`SELECT version, dirty FROM schema_migrations LIMIT 1`,
	).Scan(&version, &dirty)
	if err != nil {
		t.Fatal(err)
	}
	if uint(version) != head || dirty != 0 {
		t.Fatalf("schema_migrations: version=%d dirty=%d want version=%d dirty=0", version, dirty, head)
	}

	var name string
	if err := db.Conn.QueryRow(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'`,
	).Scan(&name); err != nil || name != "projects" {
		t.Fatalf("projects table: name=%q err=%v", name, err)
	}

	assertSQLiteIntegrity(t, db.Conn)
}

func TestReopenFileDBMigrations(t *testing.T) {
	path := filepath.Join(t.TempDir(), "polycode-migrate.db")
	head, err := HeadVersion()
	if err != nil {
		t.Fatal(err)
	}

	h1, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	db1 := h1.Value().(*DB)
	var version1 int
	if err := db1.Conn.QueryRow(`SELECT version, dirty FROM schema_migrations LIMIT 1`).Scan(&version1, new(int)); err != nil {
		t.Fatal(err)
	}
	if uint(version1) != head {
		t.Fatalf("after first open: version=%d want %d", version1, head)
	}
	if err := Close(h1); err != nil {
		t.Fatal(err)
	}

	h2, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = Close(h2) })

	db := cgo.Handle(h2).Value().(*DB)
	var version2, dirty2 int
	if err := db.Conn.QueryRow(`SELECT version, dirty FROM schema_migrations LIMIT 1`).Scan(&version2, &dirty2); err != nil {
		t.Fatal(err)
	}
	if uint(version2) != head || dirty2 != 0 {
		t.Fatalf("after reopen: version=%d dirty=%d want version=%d dirty=0", version2, dirty2, head)
	}
	if version2 != version1 {
		t.Fatalf("version changed on reopen: %d → %d", version1, version2)
	}
	assertSQLiteIntegrity(t, db.Conn)

	// Still queryable after no-op re-open.
	if _, err := db.Q.ListProjects(context.Background()); err != nil {
		t.Fatalf("ListProjects after reopen: %v", err)
	}
}

func TestBackupSQLiteWritesSiblingFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "polycode.db")
	db, _ := openTestDB(t, path)

	if _, err := db.Q.CreateProject(context.Background(), polydb.CreateProjectParams{
		ID: "proj-1", Path: "/tmp/p", CreatedAt: 1,
	}); err != nil {
		t.Fatal(err)
	}

	if err := backupSQLite(db.Conn, path); err != nil {
		t.Fatal(err)
	}

	matches, err := filepath.Glob(path + ".bak-*")
	if err != nil {
		t.Fatal(err)
	}
	if len(matches) != 1 {
		t.Fatalf("expected 1 backup file, got %v", matches)
	}

	// Backup is a readable SQLite DB with the same project row.
	bak, err := sql.Open("sqlite", matches[0])
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = bak.Close() })
	var id string
	if err := bak.QueryRow(`SELECT id FROM projects WHERE id = 'proj-1'`).Scan(&id); err != nil {
		t.Fatalf("read backup: %v", err)
	}
	if id != "proj-1" {
		t.Fatalf("backup id=%q", id)
	}
}

func TestHeadVersionFindsEmbeddedUps(t *testing.T) {
	head, err := HeadVersion()
	if err != nil {
		t.Fatal(err)
	}
	if head < 1 {
		t.Fatalf("head=%d", head)
	}
}

func assertSQLiteIntegrity(t *testing.T, conn *sql.DB) {
	t.Helper()

	rows, err := conn.Query(`PRAGMA foreign_key_check`)
	if err != nil {
		t.Fatalf("foreign_key_check: %v", err)
	}
	defer rows.Close()
	if rows.Next() {
		var table, rowid, parent, fkid any
		_ = rows.Scan(&table, &rowid, &parent, &fkid)
		t.Fatalf("foreign_key_check reported violation: table=%v rowid=%v parent=%v fkid=%v", table, rowid, parent, fkid)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	var quick string
	if err := conn.QueryRow(`PRAGMA quick_check`).Scan(&quick); err != nil {
		t.Fatalf("quick_check: %v", err)
	}
	if quick != "ok" {
		t.Fatalf("quick_check=%q want ok", quick)
	}
}

func TestDBHandleRoundTrip(t *testing.T) {
	h, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	_ = h.Value().(*DB)
	if err := Close(h); err != nil {
		t.Fatal(err)
	}
	if err := Close(h); err == nil {
		t.Fatal("expected error on second close")
	}
}

func TestTuneSQLiteMemory(t *testing.T) {
	db, _ := openTestDB(t, ":memory:")

	var fk int
	if err := db.Conn.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
		t.Fatal(err)
	}
	if fk != 1 {
		t.Fatalf("foreign_keys = %d, want 1", fk)
	}

	var busy int
	if err := db.Conn.QueryRow("PRAGMA busy_timeout").Scan(&busy); err != nil {
		t.Fatal(err)
	}
	if busy != 5000 {
		t.Fatalf("busy_timeout = %d, want 5000", busy)
	}
}

func TestTuneSQLiteFileWAL(t *testing.T) {
	path := filepath.Join(t.TempDir(), "polycode-test.db")
	db, _ := openTestDB(t, path)

	var mode string
	if err := db.Conn.QueryRow("PRAGMA journal_mode").Scan(&mode); err != nil {
		t.Fatal(err)
	}
	if mode != "wal" {
		t.Fatalf("journal_mode = %q, want wal", mode)
	}

	if _, err := db.Conn.Exec("CREATE TABLE IF NOT EXISTS _probe (id INTEGER PRIMARY KEY)"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path + "-wal"); err != nil {
		t.Fatalf("expected WAL sidecar after write: %v", err)
	}
}

func TestQueriesWorkspace(t *testing.T) {
	db, _ := openTestDB(t, ":memory:")
	ctx := context.Background()

	created, err := db.Q.CreateProject(ctx, polydb.CreateProjectParams{
		ID:        "proj-1",
		Path:      "/tmp/polycode",
		CreatedAt: 100,
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.ID != "proj-1" || created.Path != "/tmp/polycode" {
		t.Fatalf("CreateProject: %+v", created)
	}

	got, err := db.Q.GetProject(ctx, "proj-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Path != "/tmp/polycode" {
		t.Fatalf("GetProject: %+v", got)
	}

	byPath, err := db.Q.FindProjectByPath(ctx, "/tmp/polycode")
	if err != nil {
		t.Fatal(err)
	}
	if byPath.ID != "proj-1" {
		t.Fatalf("FindProjectByPath: %+v", byPath)
	}

	if _, err := db.Q.FindProjectByPath(ctx, "/does/not/exist"); err == nil {
		t.Fatal("expected no rows error for missing path")
	}

	_, err = db.Q.AddWorktree(ctx, polydb.AddWorktreeParams{
		ID:               "wt-1",
		ProjectID:        "proj-1",
		Path:             "/tmp/polycode/wt",
		IsLinkedWorktree: 0,
		ExpandedState:    0,
		CreatedAt:        100,
	})
	if err != nil {
		t.Fatal(err)
	}

	err = db.Q.UpdateWorktreeExpandedState(ctx, polydb.UpdateWorktreeExpandedStateParams{
		ExpandedState: 1,
		ID:            "wt-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	wt, err := db.Q.FindWorktreeById(ctx, "wt-1")
	if err != nil {
		t.Fatal(err)
	}
	if wt.ExpandedState != 1 {
		t.Fatalf("UpdateWorktreeExpandedState: %+v", wt)
	}

	session, err := db.Q.CreateSession(ctx, polydb.CreateSessionParams{
		ID:           "sess-1",
		ProjectID:    "proj-1",
		WorktreeID:   "wt-1",
		CreatedAt:    100,
		UpdatedAt:    100,
		LastActiveAt: 100,
	})
	if err != nil {
		t.Fatal(err)
	}
	if session.Status != "active" {
		t.Fatalf("CreateSession: %+v", session)
	}

	if err := db.Q.UpdateSessionTitle(ctx, polydb.UpdateSessionTitleParams{
		Title:        strPtr("hello"),
		UpdatedAt:    200,
		LastActiveAt: 200,
		ID:           "sess-1",
	}); err != nil {
		t.Fatal(err)
	}

	sess, err := db.Q.GetSession(ctx, "sess-1")
	if err != nil {
		t.Fatal(err)
	}
	if sess.Title == nil || *sess.Title != "hello" {
		t.Fatalf("GetSession title: %+v", sess.Title)
	}

	meta, err := db.Q.ListSessionMetadata(ctx)
	if err != nil || len(meta) != 1 {
		t.Fatalf("ListSessionMetadata: %d items, err=%v", len(meta), err)
	}

	if err := db.Q.ArchiveSession(ctx, polydb.ArchiveSessionParams{UpdatedAt: 300, ID: "sess-1"}); err != nil {
		t.Fatal(err)
	}
	sess, err = db.Q.GetSession(ctx, "sess-1")
	if err != nil {
		t.Fatal(err)
	}
	if sess.Status != "archived" {
		t.Fatalf("ArchiveSession: status=%q", sess.Status)
	}

	all, err := db.Q.ListProjects(ctx)
	if err != nil || len(all) != 1 {
		t.Fatalf("ListProjects: %d items, err=%v", len(all), err)
	}

	if err := db.Q.DeleteSession(ctx, "sess-1"); err != nil {
		t.Fatal(err)
	}
	if err := db.Q.DeleteProject(ctx, "proj-1"); err != nil {
		t.Fatal(err)
	}
}

func TestQueriesTranscript(t *testing.T) {
	db, _ := openTestDB(t, ":memory:")
	ctx := context.Background()

	_, err := db.Q.CreateProject(ctx, polydb.CreateProjectParams{
		ID: "proj-1", Path: "/p", CreatedAt: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Q.AddWorktree(ctx, polydb.AddWorktreeParams{
		ID:               "wt-1",
		ProjectID:        "proj-1",
		Path:             "/p",
		IsLinkedWorktree: 0,
		ExpandedState:    0,
		CreatedAt:        1,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Q.CreateSession(ctx, polydb.CreateSessionParams{
		ID: "sess-1", ProjectID: "proj-1", WorktreeID: "wt-1",
		CreatedAt: 1, UpdatedAt: 1, LastActiveAt: 1,
	})
	if err != nil {
		t.Fatal(err)
	}

	pos, err := db.Q.NextMessagePosition(ctx, "sess-1")
	if err != nil || pos != 0 {
		t.Fatalf("NextMessagePosition empty: pos=%d err=%v", pos, err)
	}

	msg, err := db.Q.CreateMessage(ctx, polydb.CreateMessageParams{
		ID: "msg-1", SessionID: "sess-1", Role: "user", Position: pos, Content: "hi",
	})
	if err != nil {
		t.Fatal(err)
	}
	if msg.Content != "hi" {
		t.Fatalf("CreateMessage: %+v", msg)
	}

	pos2, err := db.Q.NextMessagePosition(ctx, "sess-1")
	if err != nil || pos2 != 1 {
		t.Fatalf("NextMessagePosition after insert: pos=%d err=%v", pos2, err)
	}

	part, err := db.Q.CreatePart(ctx, polydb.CreatePartParams{
		ID: "part-1", MessageID: "msg-1", SessionID: "sess-1",
		Type: "text", Content: "body", Position: 0,
	})
	if err != nil {
		t.Fatal(err)
	}
	if part.Type != "text" {
		t.Fatalf("CreatePart: %+v", part)
	}

	msgs, err := db.Q.ListMessagesBySession(ctx, "sess-1")
	if err != nil || len(msgs) != 1 {
		t.Fatalf("ListMessagesBySession: %d err=%v", len(msgs), err)
	}

	parts, err := db.Q.ListPartsByMessage(ctx, "msg-1")
	if err != nil || len(parts) != 1 {
		t.Fatalf("ListPartsByMessage: %d err=%v", len(parts), err)
	}

	bySess, err := db.Q.ListPartsBySession(ctx, "sess-1")
	if err != nil || len(bySess) != 1 {
		t.Fatalf("ListPartsBySession: %d err=%v", len(bySess), err)
	}

	got, err := db.Q.GetMessage(ctx, "msg-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Role != "user" {
		t.Fatalf("GetMessage: %+v", got)
	}
}
