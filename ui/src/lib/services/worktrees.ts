import { api } from './api';
import type { Worktree } from '$lib/types/api';

export async function listWorktrees(projectId: string): Promise<Worktree[]> {
	return api.get(`projects/${projectId}/worktrees`).json<Worktree[]>();
}

export async function createWorktree(
	projectId: string,
	data: { branch: string }
): Promise<{ worktree: Worktree }> {
	return api.post(`projects/${projectId}/worktrees/create`, { json: data }).json();
}

/** Rename the branch checked out in a worktree (`git branch -m`). Path and worktree id are unchanged. */
export async function renameWorktreeBranch(
	projectId: string,
	worktreeId: string,
	newBranch: string
): Promise<void> {
	const encoded = encodeURIComponent(worktreeId);
	await api.patch(`projects/${projectId}/worktrees/${encoded}`, { json: { newBranch } });
}

export async function deleteWorktree(projectId: string, worktreeId: string): Promise<void> {
	const encoded = encodeURIComponent(worktreeId);
	await api.delete(`projects/${projectId}/worktrees/${encoded}`);
}
