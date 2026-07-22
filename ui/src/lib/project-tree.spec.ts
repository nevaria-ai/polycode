import { describe, expect, it } from 'vitest';
import { materializeProjectTree } from './project-tree';

const session = {
	id: 'session-1',
	title: 'Session',
	status: 'active' as const,
	createdAt: '2026-04-09T10:00:00.000Z',
	updatedAt: '2026-04-09T10:00:00.000Z',
	lastActiveAt: '2026-04-09T10:00:00.000Z'
};

const unlinkedWorktree = (expandedState = false) => ({
	id: 'test-wt-id',
	branch: 'main',
	isLinkedWorktree: false,
	expandedState,
	sessions: [] as (typeof session)[]
});

describe('materializeProjectTree', () => {
	it('adds collapsed UI state by default', () => {
		const tree = materializeProjectTree([
			{
				displayName: 'acme/repo',
				owner: 'acme',
				path: '/repo',
				projectId: 'repo-id',
				worktrees: [unlinkedWorktree()]
			}
		]);

		expect(tree[0]?.isExpanded).toBe(false);
		expect(tree[0]?.worktrees[0]?.isExpanded).toBe(false);
	});

	it('hydrates project expansion from unlinked worktree expandedState', () => {
		const tree = materializeProjectTree([
			{
				displayName: 'acme/repo',
				owner: 'acme',
				path: '/repo',
				projectId: 'repo-id',
				worktrees: [unlinkedWorktree(true)]
			}
		]);

		expect(tree[0]?.isExpanded).toBe(true);
	});

	it('preserves prior expansion state when project data refreshes', () => {
		const previous = materializeProjectTree([
			{
				displayName: 'acme/repo',
				owner: 'acme',
				path: '/repo',
				projectId: 'repo-id',
				worktrees: [unlinkedWorktree()]
			}
		]);

		previous[0]!.isExpanded = true;
		previous[0]!.worktrees[0]!.isExpanded = true;

		const next = materializeProjectTree(
			[
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					projectId: 'repo-id',
					worktrees: [
						{
							...unlinkedWorktree(),
							sessions: [session]
						}
					]
				}
			],
			previous
		);

		expect(next[0]?.isExpanded).toBe(true);
		expect(next[0]?.worktrees[0]?.isExpanded).toBe(true);
		expect(next[0]?.worktrees[0]?.sessions).toHaveLength(1);
	});
});
