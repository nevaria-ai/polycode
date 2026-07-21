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

describe('materializeProjectTree', () => {
	it('adds collapsed UI state by default', () => {
		const tree = materializeProjectTree([
			{
				displayName: 'acme/repo',
				owner: 'acme',
				path: '/repo',
				projectId: 'repo-id',
				expandedState: false,
				worktrees: [{ id: 'test-wt-id', branch: 'main', isLinkedWorktree: false, sessions: [] }]
			}
		]);

		expect(tree[0]?.isExpanded).toBe(false);
		expect(tree[0]?.worktrees[0]?.isExpanded).toBe(false);
	});

	it('hydrates project expansion from persisted expandedState', () => {
		const tree = materializeProjectTree([
			{
				displayName: 'acme/repo',
				owner: 'acme',
				path: '/repo',
				projectId: 'repo-id',
				expandedState: true,
				worktrees: [{ id: 'test-wt-id', branch: 'main', isLinkedWorktree: false, sessions: [] }]
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
				expandedState: false,
				worktrees: [{ id: 'test-wt-id', branch: 'main', isLinkedWorktree: false, sessions: [] }]
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
					expandedState: false,
					worktrees: [
						{
							id: 'test-wt-id',
							branch: 'main',
							isLinkedWorktree: false,
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
