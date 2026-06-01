import { describe, expect, it } from 'vitest';
import { materializeProjectTree } from './project-tree';

describe('materializeProjectTree', () => {
	it('adds collapsed UI state by default', () => {
		const tree = materializeProjectTree([
			{
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				expandedState: false,
				worktrees: [
					{ id: 'test-wt-id', name: 'test-wt-name', path: '/repo', branch: 'main', sessions: [] }
				]
			}
		]);

		expect(tree[0]?.isExpanded).toBe(false);
		expect(tree[0]?.worktrees[0]?.isExpanded).toBe(false);
	});

	it('hydrates project expansion from persisted expandedState', () => {
		const tree = materializeProjectTree([
			{
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				expandedState: true,
				worktrees: [
					{ id: 'test-wt-id', name: 'test-wt-name', path: '/repo', branch: 'main', sessions: [] }
				]
			}
		]);

		expect(tree[0]?.isExpanded).toBe(true);
	});

	it('preserves prior expansion state when project data refreshes', () => {
		const previous = materializeProjectTree([
			{
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				expandedState: false,
				worktrees: [
					{ id: 'test-wt-id', name: 'test-wt-name', path: '/repo', branch: 'main', sessions: [] }
				]
			}
		]);

		previous[0]!.isExpanded = true;
		previous[0]!.worktrees[0]!.isExpanded = true;

		const next = materializeProjectTree(
			[
				{
					name: 'repo',
					displayName: 'acme/repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,
					worktrees: [
						{
							id: 'test-wt-id',
							name: 'test-wt-name',
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 'session-1',
									worktreeId: 'wt-1',
									title: 'Session',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',
									createdAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
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
