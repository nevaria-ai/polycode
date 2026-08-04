import { describe, expect, it } from 'vitest';
import { getSessionsForWorktree } from './worktree';
import type { WorktreeDto } from '$lib/command';

const session = {
	id: 'session-1',
	title: 'Session',
	status: 'active' as const,
	createdAt: '2026-04-09T10:00:00.000Z',
	updatedAt: '2026-04-09T10:00:00.000Z',
	lastActiveAt: '2026-04-09T10:00:00.000Z'
};

const worktrees: WorktreeDto[] = [
	{
		id: 'main-wt',
		branch: 'main',
		isLinkedWorktree: false,
		expandedState: true,
		sessions: [session]
	},
	{
		id: 'feature-wt',
		branch: 'feature/x',
		isLinkedWorktree: true,
		expandedState: false,
		sessions: []
	}
];

describe('getSessionsForWorktree', () => {
	it('returns sessions for a worktree id', () => {
		expect(getSessionsForWorktree(worktrees, 'main-wt')).toHaveLength(1);
		expect(getSessionsForWorktree(worktrees, null)).toEqual([]);
	});
});
