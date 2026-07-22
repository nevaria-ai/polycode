CREATE TABLE projects_old (
    id TEXT PRIMARY KEY NOT NULL,
    path TEXT NOT NULL,
    expanded_state INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    removed_at INTEGER
);

INSERT INTO projects_old (id, path, expanded_state, created_at, removed_at)
SELECT id, path, 0, created_at, removed_at FROM projects;

DROP TABLE projects;
ALTER TABLE projects_old RENAME TO projects;

CREATE UNIQUE INDEX IF NOT EXISTS unique_project_path ON projects(path);

CREATE TABLE sessions_old (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    worktree_id TEXT,
    worktree_path TEXT NOT NULL DEFAULT '',
    title TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'ended', 'archived')),
    version INTEGER NOT NULL DEFAULT 1,
    has_summary INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_active_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO sessions_old (
    id, project_id, worktree_id, worktree_path, title, status, version, has_summary,
    created_at, updated_at, last_active_at
)
SELECT
    s.id, s.project_id, s.worktree_id, COALESCE(w.path, ''), s.title, s.status, s.version,
    s.has_summary, s.created_at, s.updated_at, s.last_active_at
FROM sessions s
LEFT JOIN worktrees w ON w.id = s.worktree_id;

DROP TABLE sessions;
ALTER TABLE sessions_old RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_worktree ON sessions(worktree_id);

CREATE TABLE worktrees_old (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    is_linked_worktree INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO worktrees_old (id, project_id, path, is_linked_worktree, created_at)
SELECT id, project_id, path, is_linked_worktree, created_at FROM worktrees;

DROP TABLE worktrees;
ALTER TABLE worktrees_old RENAME TO worktrees;

CREATE UNIQUE INDEX IF NOT EXISTS unique_worktree_path ON worktrees(path);
CREATE UNIQUE INDEX IF NOT EXISTS unique_worktrees_project_main
    ON worktrees(project_id, is_linked_worktree) WHERE is_linked_worktree = 0;
CREATE INDEX IF NOT EXISTS idx_worktrees_project ON worktrees(project_id);
