import { describe, expect, it } from 'vitest';
import { buildSidebarProjects } from './sidebar';
import { encodeProjectId } from '$lib/projects';
import type { Session } from '$lib/sessions';

describe('buildSidebarProjects', () => {
	it('groups sessions under their worktrees sorted by lastActiveAt descending', async () => {
		const projects = [{ name: 'repo', path: '/repo', color: '#fff' }];
		const worktreesByProject = new Map([['/repo', [{ path: '/repo', branch: 'main' }]]]);
		const projectId = encodeProjectId('/repo');
		const sessions: Session[] = [
			{
				id: 's1',
				projectId,
				worktreePath: '/repo',
				title: 'Older session',
				status: 'active',
				cliProfileId: 'p1',
				createdAt: '2026-04-09T09:00:00.000Z',
				lastActiveAt: '2026-04-09T09:00:00.000Z'
			},
			{
				id: 's2',
				projectId,
				worktreePath: '/repo',
				title: 'Newer session',
				status: 'active',
				cliProfileId: 'p1',
				createdAt: '2026-04-09T10:00:00.000Z',
				lastActiveAt: '2026-04-09T10:00:00.000Z'
			}
		];

		const result = buildSidebarProjects(projects, worktreesByProject, sessions);

		// Sessions should be sorted by lastActiveAt descending (newer first)
		expect(result[0].worktrees[0].sessions[0]?.title).toBe('Newer session');
		expect(result[0].worktrees[0].sessions[1]?.title).toBe('Older session');
		expect(result[0].displayName).toBe('repo');
	});

	it('does not filter sessions by status — filtering happens upstream in +layout.server.ts', async () => {
		const projects = [{ name: 'repo', path: '/repo', color: '#fff' }];
		const worktreesByProject = new Map([['/repo', [{ path: '/repo', branch: 'main' }]]]);
		const projectId = encodeProjectId('/repo');
		const sessions: Session[] = [
			{
				id: 's1',
				projectId,
				worktreePath: '/repo',
				title: 'Active session',
				status: 'active',
				cliProfileId: 'p1',
				createdAt: '2026-04-09T10:00:00.000Z',
				lastActiveAt: '2026-04-09T10:00:00.000Z'
			},
			{
				id: 's2',
				projectId,
				worktreePath: '/repo',
				title: 'Completed session',
				status: 'ended',
				cliProfileId: 'p1',
				createdAt: '2026-04-09T09:00:00.000Z',
				lastActiveAt: '2026-04-09T09:00:00.000Z'
			}
		];

		const result = buildSidebarProjects(projects, worktreesByProject, sessions);

		// buildSidebarProjects does not filter by status — all passed sessions appear
		const sessionTitles = result[0].worktrees[0].sessions.map((s) => s.title);
		expect(sessionTitles).toContain('Active session');
		expect(sessionTitles).toContain('Completed session');
	});

	it('prefers the remote owner/repo label when available', async () => {
		const projects = [{ name: 'repo', path: '/repo', color: '#fff' }];
		const worktreesByProject = new Map([['/repo', [{ path: '/repo', branch: 'main' }]]]);

		const result = buildSidebarProjects(
			projects,
			worktreesByProject,
			[],
			new Map([['/repo', 'acme/repo']])
		);

		expect(result[0].displayName).toBe('acme/repo');
	});

	it('falls back to the stored project name when no remote label exists', async () => {
		const projects = [{ name: 'repo', path: '/repo', color: '#fff' }];
		const worktreesByProject = new Map([['/repo', [{ path: '/repo', branch: 'main' }]]]);

		const result = buildSidebarProjects(projects, worktreesByProject, [], new Map());

		expect(result[0].displayName).toBe('repo');
	});
});
