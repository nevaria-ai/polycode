CREATE TABLE sessions (
    id TEXT PRIMARY KEY NOT NULL,
    -- Denormalized from worktrees.project_id: prompt/compile paths can load project-scoped
    -- settings (rules, etc.) without joining through worktrees.
    project_id TEXT NOT NULL,
    worktree_id TEXT NOT NULL REFERENCES worktrees(id) ON DELETE CASCADE,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'ended', 'archived')),
    version INTEGER NOT NULL DEFAULT 1,
    has_summary INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_active_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_worktree ON sessions(worktree_id);
