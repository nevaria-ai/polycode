CREATE TABLE worktrees_old (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    is_primary INTEGER NOT NULL DEFAULT 0,
    last_synced_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO worktrees_old (id, project_id, path, name, is_primary, last_synced_at, created_at)
    SELECT id, project_id, path, '',
        CASE WHEN is_linked_worktree = 1 THEN 0 ELSE 1 END,
        NULL, created_at
    FROM worktrees;

DROP TABLE worktrees;
ALTER TABLE worktrees_old RENAME TO worktrees;

CREATE UNIQUE INDEX IF NOT EXISTS unique_worktree_path ON worktrees(path);
CREATE UNIQUE INDEX IF NOT EXISTS unique_worktrees_project_primary
    ON worktrees(project_id, is_primary) WHERE is_primary = 1;
CREATE INDEX IF NOT EXISTS idx_worktrees_project ON worktrees(project_id);
