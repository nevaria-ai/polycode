import { describe, expect, it, vi } from 'vitest';
import { findGitTopLevel, listGitWorktrees, parseWorktreeList } from './git';

describe('parseWorktreeList', () => {
	it('parses git worktree porcelain output', () => {
		expect(
			parseWorktreeList(
				[
					'worktree /worktrees/main',
					'branch refs/heads/main',
					'',
					'worktree /worktrees/feature',
					'branch refs/heads/feature-x',
					''
				].join('\n')
			)
		).toEqual([
			{ path: '/worktrees/main', branch: 'main' },
			{ path: '/worktrees/feature', branch: 'feature-x' }
		]);
	});
});

describe('findGitTopLevel', () => {
	it('runs git rev-parse and normalizes the result', async () => {
		const run = vi.fn().mockResolvedValue({ stdout: '/worktrees/main\n' });

		await expect(findGitTopLevel('/worktrees/feature', run)).resolves.toBe('/worktrees/main');
		expect(run).toHaveBeenCalledWith('git', [
			'-C',
			'/worktrees/feature',
			'rev-parse',
			'--show-toplevel'
		]);
	});
});

describe('listGitWorktrees', () => {
	it('runs git worktree list and parses the result', async () => {
		const run = vi.fn().mockResolvedValue({
			stdout: ['worktree /worktrees/main', 'branch refs/heads/main', ''].join('\n')
		});

		await expect(listGitWorktrees('/worktrees/main', run)).resolves.toEqual([
			{ path: '/worktrees/main', branch: 'main' }
		]);
		expect(run).toHaveBeenCalledWith('git', [
			'-C',
			'/worktrees/main',
			'worktree',
			'list',
			'--porcelain'
		]);
	});
});
