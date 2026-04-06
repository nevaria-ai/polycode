import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeProjectPath } from '$lib/projects';

const execFile = promisify(execFileCallback);

export type ExecFileLike = (
	file: string,
	args: string[]
) => Promise<{ stdout: string; stderr?: string }>;

export type WorktreeEntry = {
	path: string;
	branch: string | null;
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
