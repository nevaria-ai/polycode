export interface SessionMetadata {
	id: string;
	title: string | null;
	status: 'active' | 'ended' | 'archived';
	createdAt: string;
	updatedAt: string;
	lastActiveAt: string;
}

export interface WorktreeWithSessions {
	id: string;
	branch: string | null;
	isLinkedWorktree: boolean;
	expandedState: boolean;
	sessions: SessionMetadata[];
}

export interface ProjectTree {
	id: string;
	path: string;
	createdAt: string;
	displayName: string;
	owner: string | null;
	worktrees: WorktreeWithSessions[];
}

export interface Session {
	id: string;
	projectId: string;
	worktreeId: string;
	title: string | null;
	status: 'active' | 'ended' | 'archived';
	version: number;
	hasSummary: boolean;
	createdAt: string;
	updatedAt: string;
	lastActiveAt: string;
}

export interface MessageView {
	id: string;
	role: 'user' | 'assistant' | 'system';
	position: number;
	content: string;
	parts: PartViewItem[];
	providerRunId: string | null;
	createdAt: string;
}

export interface PartViewItem {
	id: string;
	type: string;
	content: string;
	position: number;
	providerRunId: string | null;
	metadata: string | null;
	createdAt: string;
}

export interface PinnedContextViewItem {
	id: string;
	type: string;
	source: string;
	resolvedPath: string | null;
	content: string;
	metadata: string | null;
	pinnedAt: string;
}

export interface ProviderRunViewItem {
	id: string;
	adapterType: string;
	status: string;
	startedAt: string;
	finishedAt?: string;
	durationMs?: number;
}

export interface SessionViewData {
	session: Session | null;
	messages: MessageView[];
	pinnedContext: PinnedContextViewItem[];
	hasSummary: boolean;
	providerRuns: ProviderRunViewItem[];
}

export interface DirectoryResponse {
	suggestions: string[];
	exists: boolean;
}

export interface CreateSessionApiInput {
	worktreeId: string;
	firstSessionUnderWorktree: boolean;
	title?: string;
}

export interface RenameSessionApiInput {
	title: string;
}

export interface SubmitMessageApiInput {
	content: string;
	mentions?: { type: string; ref: string }[];
	slashCommand?: { command: string; argument?: string };
}
