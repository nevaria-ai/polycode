import { describe, expect, it } from 'vitest';
import {
	checkWorktreeHasUnmergedChanges,
	getWorktreeStatus,
	isBranchMerged,
	getDefaultBranch,
	createWorktree,
	deleteWorktree
} from './git';
import { mkdir } from 'node:fs/promises';

describe('checkWorktreeHasUnmergedChanges', () => {
	it('returns true when git status shows changes', async () => {
		const mockExec = async () => ({
			stdout: 'M src/file.ts\n',
			stderr: ''
		});

		const hasChanges = await checkWorktreeHasUnmergedChanges('/test/path', mockExec);
		expect(hasChanges).toBe(true);
	});

	it('returns false when git status is clean', async () => {
		const mockExec = async () => ({
			stdout: '',
			stderr: ''
		});

		const hasChanges = await checkWorktreeHasUnmergedChanges('/test/path', mockExec);
		expect(hasChanges).toBe(false);
	});

	it('handles git command errors gracefully', async () => {
		const mockExec = async () => {
			throw new Error('git failed');
		};

		const hasChanges = await checkWorktreeHasUnmergedChanges('/test/path', mockExec);
		expect(hasChanges).toBe(false);
	});
});

describe('getWorktreeStatus', () => {
	it('returns "clean" when git status is empty', async () => {
		const mockExec = async () => ({ stdout: '', stderr: '' });

		const status = await getWorktreeStatus('/test/path', mockExec);
		expect(status).toBe('clean');
	});

	it('returns "unmerged" when there are merge conflicts (U status)', async () => {
		const mockExec = async () => ({
			stdout: 'UU src/file.ts\n',
			stderr: ''
		});

		const status = await getWorktreeStatus('/test/path', mockExec);
		expect(status).toBe('unmerged');
	});

	it('returns "unmerged" when both sides have different changes (AA, DD)', async () => {
		const mockExec = async () => ({
			stdout: 'AA src/file.ts\nDD src/other.ts\n',
			stderr: ''
		});

		const status = await getWorktreeStatus('/test/path', mockExec);
		expect(status).toBe('unmerged');
	});

	it('returns "uncommitted" when there are modified files', async () => {
		const mockExec = async () => ({
			stdout: 'M src/file.ts\n',
			stderr: ''
		});

		const status = await getWorktreeStatus('/test/path', mockExec);
		expect(status).toBe('uncommitted');
	});

	it('returns "uncommitted" when there are staged changes', async () => {
		const mockExec = async () => ({
			stdout: 'M  src/file.ts\nA  src/new.ts\nD  src/old.ts\n',
			stderr: ''
		});

		const status = await getWorktreeStatus('/test/path', mockExec);
		expect(status).toBe('uncommitted');
	});

	it('returns "uncommitted" when there are untracked files', async () => {
		const mockExec = async () => ({
			stdout: '?? src/new.ts\n',
			stderr: ''
		});

		const status = await getWorktreeStatus('/test/path', mockExec);
		expect(status).toBe('uncommitted');
	});

	it('returns "uncommitted" for renamed files', async () => {
		const mockExec = async () => ({
			stdout: 'R  src/old.ts -> src/new.ts\n',
			stderr: ''
		});

		const status = await getWorktreeStatus('/test/path', mockExec);
		expect(status).toBe('uncommitted');
	});

	it('handles git command errors gracefully', async () => {
		const mockExec = async () => {
			throw new Error('git failed');
		};

		const status = await getWorktreeStatus('/test/path', mockExec);
		expect(status).toBe('clean');
	});
});

describe('isBranchMerged', () => {
	it('returns true when branch is in merged branches list', async () => {
		const mockExec = async () => ({
			stdout: '  main\n* feature-branch\n  merged-feature\n',
			stderr: ''
		});

		const isMerged = await isBranchMerged('/test/path', 'main', 'main', mockExec);
		expect(isMerged).toBe(true);
	});

	it('returns false when branch is not in merged branches list', async () => {
		const mockExec = async () => ({
			stdout: '  main\n  merged-feature\n',
			stderr: ''
		});

		const isMerged = await isBranchMerged('/test/path', 'feature-branch', 'main', mockExec);
		expect(isMerged).toBe(false);
	});

	it('returns false for detached head (no branch)', async () => {
		const isMerged = await isBranchMerged('/test/path', null, 'main', async () => ({
			stdout: '',
			stderr: ''
		}));
		expect(isMerged).toBe(false);
	});

	it('handles git command errors gracefully', async () => {
		const mockExec = async () => {
			throw new Error('git failed');
		};

		const isMerged = await isBranchMerged('/test/path', 'feature', 'main', mockExec);
		expect(isMerged).toBe(false);
	});
});

describe('getDefaultBranch', () => {
	it('returns "main" when origin/HEAD points to refs/remotes/origin/main', async () => {
		const mockExec = async () => ({
			stdout: 'refs/remotes/origin/main\n',
			stderr: ''
		});

		const branch = await getDefaultBranch('/test/path', mockExec);
		expect(branch).toBe('main');
	});

	it('returns "master" when origin/HEAD points to refs/remotes/origin/master', async () => {
		const mockExec = async () => ({
			stdout: 'refs/remotes/origin/master\n',
			stderr: ''
		});

		const branch = await getDefaultBranch('/test/path', mockExec);
		expect(branch).toBe('master');
	});

	it('returns "main" as fallback when no remote', async () => {
		const mockExec = async () => {
			throw new Error('git failed');
		};

		const branch = await getDefaultBranch('/test/path', mockExec);
		expect(branch).toBe('main');
	});
});

describe('createWorktree', () => {
	it('creates worktree at correct path with APP_DIR and unique suffix', async () => {
		const mockExec = async () => ({ stdout: '', stderr: '' });
		const mockMkdir: typeof mkdir = async () => {};

		const result = await createWorktree(
			'/Users/test/myproject',
			'feature-branch',
			mockExec,
			mockMkdir
		);

		expect(result.path).toContain('/.polycode/worktrees/');
		expect(result.path).toContain('myproject');
		expect(result.path).toContain('feature-branch');
		// Check for suffix (base36 timestamp)
		expect(result.path.split('-').pop()).toMatch(/^[a-z0-9]+$/);
	});
	describe('deleteWorktree', () => {
		it('removes worktree and deletes the branch', async () => {
			const calls: Array<{ file: string; args: string[] }> = [];
			const mockExec = async (file: string, args: string[]) => {
				calls.push({ file, args });
				return { stdout: '', stderr: '' };
			};

			await deleteWorktree(
				'/Users/test/myproject',
				'/.polycode/worktrees/myproject/feature-abc123',
				'feature-branch',
				mockExec
			);

			// Should call git worktree remove
			expect(calls).toHaveLength(2);
			expect(calls[0]).toEqual({
				file: 'git',
				args: [
					'-C',
					'/Users/test/myproject',
					'worktree',
					'remove',
					'/.polycode/worktrees/myproject/feature-abc123'
				]
			});
			// Should delete the branch
			expect(calls[1]).toEqual({
				file: 'git',
				args: ['-C', '/Users/test/myproject', 'branch', '-D', 'feature-branch']
			});
		});

		it('removes worktree without deleting branch when branch is null (detached)', async () => {
			const calls: Array<{ file: string; args: string[] }> = [];
			const mockExec = async (file: string, args: string[]) => {
				calls.push({ file, args });
				return { stdout: '', stderr: '' };
			};

			await deleteWorktree(
				'/Users/test/myproject',
				'/.polycode/worktrees/myproject/detached-xyz',
				null,
				mockExec
			);

			// Only worktree remove, no branch delete
			expect(calls).toHaveLength(1);
			expect(calls[0]).toEqual({
				file: 'git',
				args: [
					'-C',
					'/Users/test/myproject',
					'worktree',
					'remove',
					'/.polycode/worktrees/myproject/detached-xyz'
				]
			});
		});

		it('skips branch deletion when deleteBranch is false', async () => {
			const calls: Array<{ file: string; args: string[] }> = [];
			const mockExec = async (file: string, args: string[]) => {
				calls.push({ file, args });
				return { stdout: '', stderr: '' };
			};

			await deleteWorktree(
				'/Users/test/myproject',
				'/.polycode/worktrees/myproject/feature-abc123',
				'feature-branch',
				mockExec,
				false
			);

			// Only worktree remove, no branch delete
			expect(calls).toHaveLength(1);
			expect(calls[0]?.args).toContain('remove');
		});

		it('throws on worktree remove failure', async () => {
			const mockExec = async () => {
				throw new Error('git worktree remove failed');
			};

			await expect(
				deleteWorktree('/Users/test/myproject', '/path/to/worktree', 'feature', mockExec)
			).rejects.toThrow('git worktree remove failed');
		});

		it('still succeeds when branch deletion fails after worktree removal', async () => {
			let callCount = 0;
			const mockExec = async () => {
				callCount++;
				if (callCount === 2) {
					throw new Error('branch delete failed');
				}
				return { stdout: '', stderr: '' };
			};

			// Should NOT throw — worktree was removed, branch deletion is best-effort
			await expect(
				deleteWorktree('/Users/test/myproject', '/path/to/worktree', 'feature', mockExec)
			).resolves.toBeUndefined();
		});
	});
});
