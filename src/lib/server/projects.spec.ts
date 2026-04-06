import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectStore, resolveProjectInput } from './projects';
import * as git from './git';

describe('createProjectStore', () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(path.join(os.tmpdir(), 'polycode-projects-'));
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await rm(root, { recursive: true, force: true });
	});

	it('prepends newly added projects', async () => {
		const store = createProjectStore(path.join(root, 'projects.json'));

		await store.upsert({ name: 'first', path: '/tmp/first', color: '#111111' });
		await store.upsert({ name: 'second', path: '/tmp/second', color: '#222222' });

		expect(await store.list()).toEqual([
			{ name: 'second', path: '/tmp/second', color: '#222222' },
			{ name: 'first', path: '/tmp/first', color: '#111111' }
		]);
	});

	it('returns the existing project when the same path is added again', async () => {
		const store = createProjectStore(path.join(root, 'projects.json'));
		const existing = await store.upsert({
			name: 'polycode',
			path: '/tmp/polycode',
			color: '#d4850a'
		});

		const duplicate = await store.upsert({
			name: 'ignored',
			path: '/tmp/polycode',
			color: '#3b82f6'
		});

		expect(duplicate).toEqual(existing);
		expect(await store.list()).toHaveLength(1);
	});

	it('removes a project by path', async () => {
		const store = createProjectStore(path.join(root, 'projects.json'));
		await store.upsert({ name: 'polycode', path: '/tmp/polycode', color: '#d4850a' });

		await store.remove('/tmp/polycode');

		expect(await store.list()).toEqual([]);
	});
});

describe('resolveProjectInput', () => {
	it('prefers a main worktree over the entered worktree path', async () => {
		vi.spyOn(git, 'findGitTopLevel').mockResolvedValue('/worktrees/feature');
		vi.spyOn(git, 'listGitWorktrees').mockResolvedValue([
			{ path: '/worktrees/main', branch: 'main' },
			{ path: '/worktrees/feature', branch: 'feature-x' }
		]);

		const result = await resolveProjectInput('/worktrees/feature');

		expect(result).toEqual({
			name: 'main',
			path: '/worktrees/main'
		});
	});

	it('falls back to the entered folder name when git commands fail', async () => {
		vi.spyOn(git, 'findGitTopLevel').mockRejectedValue(new Error('not a git repo'));

		const result = await resolveProjectInput('/tmp/scratch');

		expect(result).toEqual({
			name: 'scratch',
			path: '/tmp/scratch'
		});
	});
});
