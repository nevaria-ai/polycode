CREATE TABLE worktrees_new (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    is_linked_worktree INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO worktrees_new (id, project_id, path, is_linked_worktree, created_at)
    SELECT id, project_id, path,
        CASE WHEN is_primary = 1 THEN 0 ELSE 1 END,
        created_at
    FROM worktrees;

DROP TABLE worktrees;
ALTER TABLE worktrees_new RENAME TO worktrees;

CREATE UNIQUE INDEX IF NOT EXISTS unique_worktree_path ON worktrees(path);
CREATE UNIQUE INDEX IF NOT EXISTS unique_worktrees_project_main
    ON worktrees(project_id, is_linked_worktree) WHERE is_linked_worktree = 0;
CREATE INDEX IF NOT EXISTS idx_worktrees_project ON worktrees(project_id);
