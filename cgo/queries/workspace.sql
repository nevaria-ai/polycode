-- name: CreateProject :one
INSERT INTO projects (id, path, expanded_state, created_at)
VALUES (?, ?, ?, ?)
RETURNING id, path, expanded_state, created_at, removed_at;

-- name: ListProjects :many
SELECT id, path, expanded_state, created_at, removed_at
FROM projects
WHERE removed_at IS NULL
ORDER BY created_at DESC, rowid DESC;

-- name: GetProject :one
SELECT id, path, expanded_state, created_at, removed_at
FROM projects
WHERE id = ?;

-- name: FindProjectByPath :one
SELECT id, path, expanded_state, created_at, removed_at
FROM projects
WHERE path = ?;

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = ?;

-- name: UpdateProjectExpandedState :exec
UPDATE projects
SET expanded_state = ?
WHERE id = ?;

-- name: CountSessionsByProject :one
SELECT COUNT(*) FROM sessions WHERE project_id = ?;

-- name: SoftRemoveProject :one
UPDATE projects SET removed_at = ? WHERE id = ?
RETURNING id, path, expanded_state, created_at, removed_at;

-- name: ReactivateProject :one
UPDATE projects SET removed_at = NULL WHERE id = ?
RETURNING id, path, expanded_state, created_at, removed_at;

-- name: AddWorktree :one
INSERT INTO worktrees (id, project_id, path, is_linked_worktree, created_at)
VALUES (?, ?, ?, ?, ?)
RETURNING id, project_id, path, is_linked_worktree, created_at;

-- name: FindWorktreeById :one
SELECT id, project_id, path, is_linked_worktree, created_at
FROM worktrees WHERE id = ?;

-- name: CreateSession :one
INSERT INTO sessions (
    id, project_id, worktree_id, worktree_path,
    status, version, has_summary, created_at, updated_at, last_active_at
) VALUES (?, ?, ?, ?, 'active', 1, 0, ?, ?, ?)
RETURNING
    id, project_id, worktree_id, worktree_path,
    title, status, version, has_summary, created_at, updated_at, last_active_at;

-- name: GetSession :one
SELECT
    id, project_id, worktree_id, worktree_path,
    title, status, version, has_summary, created_at, updated_at, last_active_at
FROM sessions
WHERE id = ?;

-- name: ListSessionsByProject :many
SELECT
    id, project_id, worktree_id, worktree_path,
    title, status, version, has_summary, created_at, updated_at, last_active_at
FROM sessions
WHERE project_id = ?
ORDER BY updated_at DESC;

-- name: ListAllSessions :many
SELECT
    id, project_id, worktree_id, worktree_path,
    title, status, version, has_summary, created_at, updated_at, last_active_at
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
