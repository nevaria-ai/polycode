import { describe, expect, it } from 'vitest';
import { materializeSidebarTree } from './sidebar-tree';

describe('materializeSidebarTree', () => {
	it('adds collapsed UI state by default', () => {
		const tree = materializeSidebarTree([
			{
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				color: '#fff',
				worktrees: [{ path: '/repo', branch: 'main', sessions: [] }]
			}
		]);

		expect(tree[0]?.isExpanded).toBe(false);
		expect(tree[0]?.worktrees[0]?.isExpanded).toBe(false);
	});

	it('preserves prior expansion state when sidebar data refreshes', () => {
		const previous = materializeSidebarTree([
			{
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				color: '#fff',
				worktrees: [{ path: '/repo', branch: 'main', sessions: [] }]
			}
		]);

		previous[0]!.isExpanded = true;
		previous[0]!.worktrees[0]!.isExpanded = true;

		const next = materializeSidebarTree(
			[
				{
					name: 'repo',
					displayName: 'acme/repo',
					path: '/repo',
					projectId: 'repo-id',
					color: '#fff',
					worktrees: [
						{
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 'session-1',
									title: 'Session',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',
									cliProfileId: 'profile-1',
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
