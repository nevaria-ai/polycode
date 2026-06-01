-- Existing tables (matching current Drizzle schema exactly)

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    expanded_state INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS worktrees (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    last_synced_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_worktree_path ON worktrees(path);
CREATE UNIQUE INDEX IF NOT EXISTS unique_worktrees_project_primary ON worktrees(project_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_worktrees_project ON worktrees(project_id);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    worktree_id TEXT,
    worktree_path TEXT NOT NULL,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'ended', 'archived')),
    version INTEGER NOT NULL DEFAULT 1,
    has_summary INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_active_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_worktree ON sessions(worktree_id);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    position INTEGER NOT NULL,
    content TEXT NOT NULL,
    provider_run_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_messages_session_position ON messages(session_id, position);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS parts (
    id TEXT PRIMARY KEY NOT NULL,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('text', 'reasoning', 'tool_call', 'tool_result', 'file', 'agent', 'compaction', 'diff_summary', 'diagnostic_summary', 'search_summary')),
    content TEXT NOT NULL,
    position INTEGER NOT NULL,
    metadata TEXT,
    provider_run_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_parts_message ON parts(message_id);
CREATE INDEX IF NOT EXISTS idx_parts_session ON parts(session_id);
CREATE INDEX IF NOT EXISTS idx_parts_session_position ON parts(session_id, position);

CREATE TABLE IF NOT EXISTS context_items (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('file', 'folder', 'search', 'diff', 'diagnostics', 'url')),
    source TEXT NOT NULL,
    resolved_path TEXT,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS message_context_items (
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    context_item_id TEXT NOT NULL REFERENCES context_items(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, context_item_id)
);

CREATE TABLE IF NOT EXISTS pinned_context (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    context_item_id TEXT NOT NULL REFERENCES context_items(id) ON DELETE CASCADE,
    pinned_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_session_context ON pinned_context(session_id, context_item_id);

CREATE TABLE IF NOT EXISTS provider_runs (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
    adapter_type TEXT NOT NULL CHECK(adapter_type IN ('claude-cli', 'gemini-cli')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'succeeded', 'failed_pre', 'failed_exec', 'failed_parse')),
    started_at INTEGER NOT NULL DEFAULT (unixepoch()),
    finished_at INTEGER,
    duration_ms INTEGER,
    provider_session_id TEXT,
    provider_model TEXT,
    error_message TEXT,
    raw_output_pointer TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_runs_session ON provider_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_provider_runs_message ON provider_runs(message_id);

CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_position INTEGER NOT NULL,
    token_count INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
    part_id TEXT REFERENCES parts(id) ON DELETE SET NULL,
    provider_run_id TEXT REFERENCES provider_runs(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK(type IN ('diff', 'command_output', 'diagnostics', 'search_results', 'raw_provider_output', 'compaction_summary')),
    content TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(session_id);

CREATE TABLE IF NOT EXISTS session_events (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL,
    correlation_id TEXT,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_events_session_position ON session_events(session_id, position);
CREATE INDEX IF NOT EXISTS idx_events_session_created ON session_events(session_id, created_at);
