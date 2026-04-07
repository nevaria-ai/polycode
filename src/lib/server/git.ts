import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { normalize, basename } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { normalizeProjectPath } from '$lib/projects';
import { APP_DIR } from './index';

const execFile = promisify(execFileCallback);

export type ExecFileLike = (
	file: string,
	args: string[]
) => Promise<{ stdout: string; stderr?: string }>;

export type WorktreeStatus = 'clean' | 'uncommitted' | 'unmerged';

export type WorktreeEntry = {
	path: string;
	branch: string | null;
	status?: WorktreeStatus;
	isMerged?: boolean;
};

export function parseWorktreeList(output: string): WorktreeEntry[] {
	const blocks = output.trim().split('\n\n').filter(Boolean);

	return blocks.map((block) => {
		const lines = block.split('\n');
		const worktreePath = lines.find((line) => line.startsWith('worktree '))?.slice(9) ?? '';
		const branchRef = lines.find((line) => line.startsWith('branch '))?.slice(7) ?? null;

		return {
			path: worktreePath,
			branch: branchRef ? branchRef.replace('refs/heads/', '') : null
		};
	});
}

export async function findGitTopLevel(
	inputPath: string,
	run: ExecFileLike = execFile
): Promise<string> {
	const result = await run('git', ['-C', inputPath, 'rev-parse', '--show-toplevel']);
	return normalizeProjectPath(result.stdout.trim());
}

export async function listGitWorktrees(
	repoPath: string,
	run: ExecFileLike = execFile
): Promise<WorktreeEntry[]> {
	const result = await run('git', ['-C', repoPath, 'worktree', 'list', '--porcelain']);
	return parseWorktreeList(result.stdout);
}

export async function checkWorktreeHasUnmergedChanges(
	worktreePath: string,
	run: ExecFileLike = execFile
): Promise<boolean> {
	const status = await getWorktreeStatus(worktreePath, run);
	return status !== 'clean';
}

export async function getWorktreeStatus(
	worktreePath: string,
	run: ExecFileLike = execFile
): Promise<WorktreeStatus> {
	try {
		const result = await run('git', ['-C', worktreePath, 'status', '--porcelain']);
		const output = result.stdout.trim();

		if (!output) {
			return 'clean';
		}

		// Check for unmerged status codes (merge conflicts)
		const lines = output.split('\n');
		for (const line of lines) {
			// Git status --porcelain format: XY filename
			// X = staged status, Y = unstaged status
			// U = unmerged, AA = both added, DD = both deleted, etc.
			const statusCode = line.slice(0, 2);
			if (statusCode.includes('U') || statusCode === 'AA' || statusCode === 'DD') {
				return 'unmerged';
			}
		}

		return 'uncommitted';
	} catch {
		return 'clean';
	}
}

export async function isBranchMerged(
	worktreePath: string,
	branch: string | null,
	targetBranch: string,
	run: ExecFileLike = execFile
): Promise<boolean> {
	if (!branch) return false;

	try {
		const result = await run('git', ['-C', worktreePath, 'branch', '--merged', targetBranch]);
		const mergedBranches = result.stdout
			.trim()
			.split('\n')
			.map((b) => b.trim().replace('*', '').trim())
			.filter(Boolean);

		return mergedBranches.includes(branch);
	} catch {
		return false;
	}
}

export async function getDefaultBranch(
	repoPath: string,
	run: ExecFileLike = execFile
): Promise<string> {
	try {
		// Check origin/HEAD to see what the default branch is
		const result = await run('git', ['-C', repoPath, 'symbolic-ref', 'refs/remotes/origin/HEAD']);
		const ref = result.stdout.trim();
		// Extract branch name from refs/remotes/origin/<branch>
		const branch = ref.split('/').pop();
		return branch || 'main';
	} catch {
		// Fallback to checking common branch names
		return 'main';
	}
}

export async function createWorktree(
	repoPath: string,
	branchName: string,
	run: ExecFileLike = execFile,
	makeDir: typeof mkdir = mkdir
): Promise<WorktreeEntry> {
	// Extract project name from repo path
	const projectName = basename(repoPath);
	// Add unique suffix to prevent path collisions
	const suffix = Date.now().toString(36);
	const worktreePath = normalize(`${APP_DIR}/worktrees/${projectName}/${branchName}-${suffix}`);

	// Ensure the directory exists
	await makeDir(normalize(`${APP_DIR}/worktrees/${projectName}`), { recursive: true });

	// Create the worktree and branch together so new branch names work from the UI.
	await run('git', ['-C', repoPath, 'worktree', 'add', '-b', branchName, worktreePath]);

	return {
		path: worktreePath,
		branch: branchName
	};
}
