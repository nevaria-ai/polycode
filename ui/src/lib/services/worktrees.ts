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

export async function renameWorktree(
	projectId: string,
	worktreePath: string,
	data: { oldBranch: string; newBranch: string }
): Promise<void> {
	const encoded = encodeURIComponent(worktreePath);
	await api.patch(`projects/${projectId}/worktrees/${encoded}`, { json: data });
}

export async function deleteWorktree(
	projectId: string,
	worktreePath: string,
	data: { branch: string }
): Promise<void> {
	const encoded = encodeURIComponent(worktreePath);
	await api.delete(`projects/${projectId}/worktrees/${encoded}`, { json: data });
}
