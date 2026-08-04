import { beforeEach, describe, expect, it } from 'vitest';
import { worktreeExpanded } from './worktree-expanded.svelte';

const worktree = {
	id: 'wt-1',
	branch: 'main',
	isLinkedWorktree: false,
	expandedState: false,
	sessions: []
};

describe('worktree expand overlay', () => {
	beforeEach(() => {
		worktreeExpanded.clear();
	});

	it('falls back to worktree.expandedState when overlay is empty', () => {
		expect(worktreeExpanded.get(worktree)).toBe(false);
		expect(worktreeExpanded.get({ ...worktree, expandedState: true })).toBe(true);
	});

	it('overlay wins over expandedState until cleared', () => {
		worktreeExpanded.set('wt-1', true);
		expect(worktreeExpanded.get({ ...worktree, expandedState: false })).toBe(true);

		worktreeExpanded.clear();
		expect(worktreeExpanded.get({ ...worktree, expandedState: false })).toBe(false);
	});
});
