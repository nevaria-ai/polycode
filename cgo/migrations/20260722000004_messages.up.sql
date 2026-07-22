CREATE TABLE messages (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    position INTEGER NOT NULL,
    content TEXT NOT NULL,
    provider_run_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX unique_messages_session_position ON messages(session_id, position);
CREATE INDEX idx_messages_session_created ON messages(session_id, created_at);

CREATE TABLE parts (
    id TEXT PRIMARY KEY NOT NULL,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN (
        'text', 'reasoning', 'tool_call', 'tool_result', 'file', 'agent',
        'compaction', 'diff_summary', 'diagnostic_summary', 'search_summary'
    )),
    content TEXT NOT NULL,
    position INTEGER NOT NULL,
    metadata TEXT,
    provider_run_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_parts_message ON parts(message_id);
CREATE INDEX idx_parts_session ON parts(session_id);
CREATE INDEX idx_parts_session_position ON parts(session_id, position);
