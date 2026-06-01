DROP INDEX IF EXISTS unique_worktrees_project_primary;
CREATE UNIQUE INDEX IF NOT EXISTS unique_worktrees_project_primary ON worktrees(project_id, is_primary);
