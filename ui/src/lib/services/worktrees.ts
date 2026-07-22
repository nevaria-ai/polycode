import { api } from './api';

export async function createWorktree(projectId: string, data: { branch: string }): Promise<void> {
	await api.post(`projects/${projectId}/worktrees/create`, { json: data });
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

export async function updateWorktreeExpandedState(
	projectId: string,
	worktreeId: string,
	expandedState: boolean
): Promise<void> {
	const encoded = encodeURIComponent(worktreeId);
	await api.patch(`projects/${projectId}/worktrees/${encoded}/expanded-state`, {
		json: { expandedState }
	});
}
