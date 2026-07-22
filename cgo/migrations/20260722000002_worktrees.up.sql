CREATE TABLE worktrees (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    is_linked_worktree INTEGER NOT NULL DEFAULT 0,
    expanded_state INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX unique_worktree_path ON worktrees(path);
CREATE UNIQUE INDEX unique_worktrees_project_unlinked
    ON worktrees(project_id, is_linked_worktree) WHERE is_linked_worktree = 0;
CREATE INDEX idx_worktrees_project ON worktrees(project_id);
