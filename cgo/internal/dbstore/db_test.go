package dbstore

import (
	"context"
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

	var version int
	var dirty int
	err := db.Conn.QueryRow(
		`SELECT version, dirty FROM schema_migrations LIMIT 1`,
	).Scan(&version, &dirty)
	if err != nil {
		t.Fatal(err)
	}
	if version < 1 || dirty != 0 {
		t.Fatalf("schema_migrations: version=%d dirty=%d", version, dirty)
	}

	var name string
	if err := db.Conn.QueryRow(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'`,
	).Scan(&name); err != nil || name != "projects" {
		t.Fatalf("projects table: name=%q err=%v", name, err)
	}
}

func TestReopenFileDBMigrations(t *testing.T) {
	path := filepath.Join(t.TempDir(), "polycode-migrate.db")

	h1, err := Open(path)
	if err != nil {
		t.Fatal(err)
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
	var version int
	if err := db.Conn.QueryRow(`SELECT MAX(version) FROM schema_migrations`).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if version < 1 {
		t.Fatalf("version after reopen: %d", version)
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
		ID:            "proj-1",
		Name:          "polycode",
		Path:          "/tmp/polycode",
		ExpandedState: 0,
		CreatedAt:     100,
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.ID != "proj-1" || created.Name != "polycode" {
		t.Fatalf("CreateProject: %+v", created)
	}

	got, err := db.Q.GetProject(ctx, "proj-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Path != "/tmp/polycode" {
		t.Fatalf("GetProject: %+v", got)
	}

	updated, err := db.Q.UpdateProjectExpandedState(ctx, polydb.UpdateProjectExpandedStateParams{
		ExpandedState: 1,
		ID:            "proj-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.ExpandedState != 1 {
		t.Fatalf("UpdateProjectExpandedState: %+v", updated)
	}

	session, err := db.Q.CreateSession(ctx, polydb.CreateSessionParams{
		ID:           "sess-1",
		ProjectID:    "proj-1",
		WorktreePath: "/tmp/polycode/wt",
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

	byProject, err := db.Q.ListSessionsByProject(ctx, "proj-1")
	if err != nil || len(byProject) != 1 {
		t.Fatalf("ListSessionsByProject: %d items, err=%v", len(byProject), err)
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
		ID: "proj-1", Name: "p", Path: "/p", CreatedAt: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Q.CreateSession(ctx, polydb.CreateSessionParams{
		ID: "sess-1", ProjectID: "proj-1", WorktreePath: "/p",
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
