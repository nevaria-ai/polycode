export interface WorktreeView {
	path: string;
	name: string;
	isPrimary: boolean;
	branch: string | null;
	status?: 'clean' | 'uncommitted' | 'unmerged';
	lastSyncedAt: string | null;
	sessionCount: number;
}

export interface ProjectView {
	id: string;
	name: string;
	path: string;
	expandedState: boolean;
	createdAt: string;
	worktreeCount: number;
	totalSessionCount: number;
}

export interface ProjectDetailView {
	id: string;
	name: string;
	path: string;
	expandedState: boolean;
	createdAt: string;
	worktrees: WorktreeView[];
}

export interface ProjectListItem {
	id: string;
	name: string;
	path: string;
}

export interface CreateProjectApiInput {
	path: string;
}

export interface UpdateProjectApiInput {
	expandedState?: boolean;
}

export interface CreateWorktreeApiInput {
	projectId: string;
	path: string;
	name: string;
}
