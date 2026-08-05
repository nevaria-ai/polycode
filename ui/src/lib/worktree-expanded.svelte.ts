import type { WorktreeDto } from '$lib/command';
import { SvelteSet } from 'svelte/reactivity';

/**
 * Optimistic worktree expand overlay.
 * Toggle writes here + updateWorktreeExpandedState (no project:tree invalidate).
 * Cleared in +layout load after listProjects returns so DB expandedState wins
 * without flashing collapsed while the fetch is in flight.
 *
 * tryBegin/end ignore overlapping clicks for the same worktree so concurrent
 * API writes cannot leave UI and DB disagreeing.
 */
let expandedByWorktreeId = $state<Record<string, boolean>>({});
const pendingWorktreeIds = new SvelteSet<string>();

export const worktreeExpanded = {
	get(worktree: WorktreeDto): boolean {
		return expandedByWorktreeId[worktree.id] ?? worktree.expandedState;
	},

	set(worktreeId: string, expanded: boolean): void {
		expandedByWorktreeId[worktreeId] = expanded;
	},

	/** Returns false if a toggle for this worktree is already in flight. */
	tryBegin(worktreeId: string): boolean {
		if (pendingWorktreeIds.has(worktreeId)) return false;
		pendingWorktreeIds.add(worktreeId);
		return true;
	},

	end(worktreeId: string): void {
		pendingWorktreeIds.delete(worktreeId);
	},

	clear(): void {
		expandedByWorktreeId = {};
		pendingWorktreeIds.clear();
	}
};
