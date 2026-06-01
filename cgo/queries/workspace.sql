-- name: CreateProject :one
INSERT INTO projects (id, name, path, expanded_state, created_at)
VALUES (?, ?, ?, ?, ?)
RETURNING id, name, path, expanded_state, created_at;

-- name: ListProjects :many
SELECT id, name, path, expanded_state, created_at
FROM projects
ORDER BY created_at DESC, rowid DESC;

-- name: GetProject :one
SELECT id, name, path, expanded_state, created_at
FROM projects
WHERE id = ?;

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = ?;

-- name: UpdateProjectExpandedState :one
UPDATE projects
SET expanded_state = ?
WHERE id = ?
RETURNING id, name, path, expanded_state, created_at;

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
