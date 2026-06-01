export type SessionStatus = 'active' | 'ended' | 'archived';
export type MessageRole = 'user' | 'assistant' | 'system';
export type PartType =
	| 'text'
	| 'reasoning'
	| 'tool_call'
	| 'tool_result'
	| 'file'
	| 'agent'
	| 'compaction'
	| 'diff_summary'
	| 'diagnostic_summary'
	| 'search_summary';
export type ContextItemType = 'file' | 'folder' | 'search' | 'diff' | 'diagnostics' | 'url';
export type AdapterType = 'claude-cli' | 'gemini-cli';

export type Session = {
	id: string;
	projectId: string;
	worktreeId: string | null;
	worktreePath: string;
	title: string | null;
	status: 'active' | 'ended' | 'archived';
	version?: number;
	hasSummary?: boolean;
	createdAt: string;
	updatedAt?: string;
	lastActiveAt: string;
};

export type WorktreeEntry = {
	id: string;
	name: string;
	path: string;
	branch: string | null;
	status?: 'clean' | 'uncommitted' | 'unmerged';
	isMerged?: boolean;
};

export type WorktreeWithSessions = WorktreeEntry & {
	sessions: Session[];
};

export function isSessionActive(session: { status: string }): boolean {
	return session.status === 'active';
}

export function isSessionArchived(session: { status: string }): boolean {
	return session.status === 'archived';
}

export function isSessionEnded(session: { status: string }): boolean {
	return session.status === 'ended';
}

export function getSessionTitle(session: { id: string; title: string | null }): string {
	return session.title || `Session ${session.id.slice(0, 8)}`;
}

export function sortSessionsByLastActive<T extends Session>(sessions: T[]): T[] {
	return [...sessions].sort((a, b) => {
		const aTime = new Date(a.lastActiveAt).getTime();
		const bTime = new Date(b.lastActiveAt).getTime();
		return bTime - aTime;
	});
}

export function filterSessionsByStatus<T extends Session>(
	sessions: T[],
	status: SessionStatus
): T[] {
	return sessions.filter((s) => s.status === status);
}

export function getActiveSessions<T extends Session>(sessions: T[]): T[] {
	return filterSessionsByStatus(sessions, 'active');
}

export function getArchivedSessions<T extends Session>(sessions: T[]): T[] {
	return filterSessionsByStatus(sessions, 'archived');
}
