CREATE TABLE projects_new (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    expanded_state INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO projects_new (id, name, path, expanded_state, created_at)
    SELECT id, name, name, 0, created_at FROM projects;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;
