-- name: CreateProject :one
INSERT INTO projects (id, path, created_at)
VALUES (?, ?, ?)
RETURNING id, path, created_at, removed_at;

-- name: ListProjects :many
SELECT id, path, created_at, removed_at
FROM projects
WHERE removed_at IS NULL
ORDER BY created_at DESC, rowid DESC;

-- name: GetProject :one
SELECT id, path, created_at, removed_at
FROM projects
WHERE id = ?;

-- name: FindProjectByPath :one
SELECT id, path, created_at, removed_at
FROM projects
WHERE path = ?;

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = ?;

-- name: CountSessionsByProject :one
SELECT COUNT(*) FROM sessions WHERE project_id = ?;

-- name: SoftRemoveProject :one
UPDATE projects SET removed_at = ? WHERE id = ?
RETURNING id, path, created_at, removed_at;

-- name: ReactivateProject :one
UPDATE projects SET removed_at = NULL WHERE id = ?
RETURNING id, path, created_at, removed_at;

-- name: AddWorktree :one
INSERT INTO worktrees (id, project_id, path, is_linked_worktree, expanded_state, created_at)
VALUES (?, ?, ?, ?, ?, ?)
RETURNING id, project_id, path, is_linked_worktree, expanded_state, created_at;

-- name: FindWorktreeById :one
SELECT id, project_id, path, is_linked_worktree, expanded_state, created_at
FROM worktrees WHERE id = ?;

-- name: ListWorktreesByProject :many
SELECT id, project_id, path, is_linked_worktree, expanded_state, created_at
FROM worktrees
WHERE project_id = ?
ORDER BY is_linked_worktree ASC, created_at ASC;

-- name: DeleteWorktreeById :exec
DELETE FROM worktrees WHERE id = ?;

-- name: UpdateWorktreeExpandedState :exec
UPDATE worktrees
SET expanded_state = ?
WHERE id = ?;

-- name: CreateSession :one
INSERT INTO sessions (
    id, project_id, worktree_id,
    status, version, has_summary, created_at, updated_at, last_active_at
) VALUES (?, ?, ?, 'active', 1, 0, ?, ?, ?)
RETURNING
    id, project_id, worktree_id,
    title, status, version, has_summary, created_at, updated_at, last_active_at;

-- name: GetSession :one
SELECT
    id, project_id, worktree_id,
    title, status, version, has_summary, created_at, updated_at, last_active_at
FROM sessions
WHERE id = ?;

-- Slim rows for sidebar tree nesting (excludes version / has_summary).
-- name: ListSessionMetadata :many
SELECT
    id, project_id, worktree_id,
    title, status, created_at, updated_at, last_active_at
FROM sessions
ORDER BY last_active_at DESC;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = ?;

-- name: UpdateSessionTitle :exec
UPDATE sessions
SET title = ?, updated_at = ?, last_active_at = ?
WHERE id = ?;

-- name: ArchiveSession :exec
UPDATE sessions
SET status = 'archived', updated_at = ?
WHERE id = ?;
