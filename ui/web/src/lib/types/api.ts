export interface Project {
	id: string;
	name: string;
	path: string;
	expandedState: boolean;
	createdAt: string;
}

export interface Session {
	id: string;
	projectId: string;
	worktreeId: string | null;
	worktreePath: string;
	title: string | null;
	status: 'active' | 'ended' | 'archived';
	version: number;
	hasSummary: boolean;
	createdAt: string;
	updatedAt: string;
	lastActiveAt: string;
}

export interface Worktree {
	id: string;
	projectId: string;
	path: string;
	name: string;
	isPrimary: boolean;
	branch: string | null;
	status?: string;
	lastSyncedAt: string | null;
	sessionCount: number;
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

export interface SidebarProject {
	path: string;
	name: string;
	displayName?: string;
	projectId: string;
	defaultBranchLabel?: string | null;
	sessions: Session[];
	worktrees: Array<Worktree & { sessions: Session[] }>;
}

export interface CreateSessionApiInput {
	worktreeId?: string | null;
	worktreePath: string;
	title?: string;
}

export interface RenameSessionApiInput {
	title: string;
}

export interface ArchiveSessionApiInput {}

export interface SubmitMessageApiInput {
	content: string;
	mentions?: { type: string; ref: string }[];
	slashCommand?: { command: string; argument?: string };
}
