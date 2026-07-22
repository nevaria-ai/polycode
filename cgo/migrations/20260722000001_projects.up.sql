CREATE TABLE projects (
    id TEXT PRIMARY KEY NOT NULL,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    removed_at INTEGER
);

CREATE UNIQUE INDEX unique_project_path ON projects(path);
