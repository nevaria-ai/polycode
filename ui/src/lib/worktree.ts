import type { WorktreeDto } from '$lib/command';

export function getSessionsForWorktree(
	worktrees: WorktreeDto[],
	worktreeId: string | null
): WorktreeDto['sessions'] {
	if (!worktreeId) return [];
	return worktrees.find((worktree) => worktree.id === worktreeId)?.sessions ?? [];
}
