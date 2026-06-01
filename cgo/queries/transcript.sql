-- name: CreateMessage :one
INSERT INTO messages (id, session_id, role, position, content)
VALUES (?, ?, ?, ?, ?)
RETURNING id, session_id, role, position, content, provider_run_id, created_at;

-- name: ListMessagesBySession :many
SELECT id, session_id, role, position, content, provider_run_id, created_at
FROM messages
WHERE session_id = ?
ORDER BY position ASC;

-- name: GetMessage :one
SELECT id, session_id, role, position, content, provider_run_id, created_at
FROM messages
WHERE id = ?;

-- name: NextMessagePosition :one
SELECT COALESCE(MAX(position), -1) + 1
FROM messages
WHERE session_id = ?;

-- name: CreatePart :one
INSERT INTO parts (id, message_id, session_id, type, content, position, metadata)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING id, message_id, session_id, type, content, position, metadata, provider_run_id, created_at;

-- name: ListPartsByMessage :many
SELECT id, message_id, session_id, type, content, position, metadata, provider_run_id, created_at
FROM parts
WHERE message_id = ?
ORDER BY position ASC;

-- name: ListPartsBySession :many
SELECT id, message_id, session_id, type, content, position, metadata, provider_run_id, created_at
FROM parts
WHERE session_id = ?
ORDER BY position ASC;
