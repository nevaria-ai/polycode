import type { WorktreeEntry } from '$lib/server/git';

export type Session = {
	id: string;
	cliProfileId: string;
	projectId: string;
	worktreePath: string;
	title: string | null;
	status: 'active' | 'ended';
	createdAt: string;
	lastActiveAt: string;
};

export type WorktreeWithSessions = WorktreeEntry & {
	sessions: Session[];
};
