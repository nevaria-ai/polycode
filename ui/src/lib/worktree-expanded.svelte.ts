import type { WorktreeDto } from '$lib/command';

/**
 * Optimistic worktree expand overlay.
 * Toggle writes here + updateWorktreeExpandedState (no project:tree invalidate).
 * Cleared in +layout load on every project:tree reload so DB expandedState wins
 * (including same-id re-add after delete/close).
 */
let expandedByWorktreeId = $state<Record<string, boolean>>({});

export const worktreeExpanded = {
	get(worktree: WorktreeDto): boolean {
		return expandedByWorktreeId[worktree.id] ?? worktree.expandedState;
	},

	set(worktreeId: string, expanded: boolean): void {
		expandedByWorktreeId[worktreeId] = expanded;
	},

	clear(): void {
		expandedByWorktreeId = {};
	}
};
