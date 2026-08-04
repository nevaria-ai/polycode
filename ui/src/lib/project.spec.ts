import { describe, expect, it } from 'vitest';
import {
	decodeProjectId,
	encodeProjectId,
	getLinkedWorktrees,
	getUnlinkedWorktree,
	isGitProject,
	normalizeProjectPath
} from './project';
import type { ProjectDto } from '$lib/command';

describe('normalizeProjectPath', () => {
	it('returns an absolute normalized path without a trailing slash', () => {
		expect(normalizeProjectPath('/tmp/demo/../demo/')).toBe('/tmp/demo');
	});
});

describe('projectId helpers', () => {
	it('round-trips a normalized absolute path through base64url encoding', () => {
		const path = '/Projects/opensource-projects/esk-code';
		const projectId = encodeProjectId(path);

		expect(projectId).not.toContain('=');
		expect(decodeProjectId(projectId)).toBe(path);
	});
});

const session = {
	id: 'session-1',
	title: 'Session',
	status: 'active' as const,
	createdAt: '2026-04-09T10:00:00.000Z',
	updatedAt: '2026-04-09T10:00:00.000Z',
	lastActiveAt: '2026-04-09T10:00:00.000Z'
};

const project: ProjectDto = {
	id: 'repo-id',
	path: '/repo',
	createdAt: '2026-04-09T10:00:00.000Z',
	displayName: 'acme/repo',
	owner: 'acme',
	worktrees: [
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
	]
};

describe('project worktree helpers', () => {
	it('finds the unlinked worktree', () => {
		expect(getUnlinkedWorktree(project)?.id).toBe('main-wt');
	});

	it('lists linked worktrees', () => {
		expect(getLinkedWorktrees(project).map((worktree) => worktree.id)).toEqual(['feature-wt']);
	});

	it('treats a branched unlinked worktree as git', () => {
		expect(isGitProject(project)).toBe(true);
	});

	it('treats a non-git synthetic worktree as a folder', () => {
		const nonGit: ProjectDto = {
			...project,
			worktrees: [
				{
					id: 'folder-wt',
					branch: null,
					isLinkedWorktree: false,
					expandedState: false,
					sessions: []
				}
			]
		};
		expect(isGitProject(nonGit)).toBe(false);
	});

	it('treats detached HEAD with linked worktrees as git', () => {
		const detachedWithLinked: ProjectDto = {
			...project,
			worktrees: [
				{
					id: 'main-wt',
					branch: null,
					isLinkedWorktree: false,
					expandedState: false,
					sessions: []
				},
				{
					id: 'feature-wt',
					branch: 'feature/x',
					isLinkedWorktree: true,
					expandedState: false,
					sessions: []
				}
			]
		};
		expect(isGitProject(detachedWithLinked)).toBe(true);
	});
});
