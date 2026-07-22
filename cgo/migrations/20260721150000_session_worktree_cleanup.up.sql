-- Worktree expand state; sessions FK to worktrees; drop session path and project expand.

ALTER TABLE worktrees ADD COLUMN expanded_state INTEGER NOT NULL DEFAULT 0;

UPDATE worktrees
SET expanded_state = (
    SELECT expanded_state FROM projects WHERE projects.id = worktrees.project_id
)
WHERE is_linked_worktree = 0;

INSERT OR IGNORE INTO worktrees (id, project_id, path, is_linked_worktree, expanded_state, created_at)
SELECT DISTINCT
    s.worktree_id,
    s.project_id,
    COALESCE(NULLIF(s.worktree_path, ''), p.path),
    CASE WHEN COALESCE(NULLIF(s.worktree_path, ''), p.path) = p.path THEN 0 ELSE 1 END,
    0,
    unixepoch()
FROM sessions s
JOIN projects p ON p.id = s.project_id
WHERE s.worktree_id IS NOT NULL
  AND s.worktree_id != ''
  AND NOT EXISTS (SELECT 1 FROM worktrees w WHERE w.id = s.worktree_id);

DELETE FROM sessions WHERE worktree_id IS NULL OR worktree_id = '';

CREATE TABLE sessions_new (
    id TEXT PRIMARY KEY NOT NULL,
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

INSERT INTO sessions_new (
    id, project_id, worktree_id, title, status, version, has_summary,
    created_at, updated_at, last_active_at
)
SELECT
    id, project_id, worktree_id, title, status, version, has_summary,
    created_at, updated_at, last_active_at
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_worktree ON sessions(worktree_id);

CREATE TABLE projects_new (
    id TEXT PRIMARY KEY NOT NULL,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    removed_at INTEGER
);

INSERT INTO projects_new (id, path, created_at, removed_at)
SELECT id, path, created_at, removed_at FROM projects;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

CREATE UNIQUE INDEX IF NOT EXISTS unique_project_path ON projects(path);
