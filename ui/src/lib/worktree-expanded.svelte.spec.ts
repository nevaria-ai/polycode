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

	it('tryBegin allows one in-flight toggle per worktree id', () => {
		expect(worktreeExpanded.tryBegin('wt-1')).toBe(true);
		expect(worktreeExpanded.tryBegin('wt-1')).toBe(false);
		expect(worktreeExpanded.tryBegin('wt-2')).toBe(true);

		worktreeExpanded.end('wt-1');
		expect(worktreeExpanded.tryBegin('wt-1')).toBe(true);
	});

	it('clear drops pending locks', () => {
		expect(worktreeExpanded.tryBegin('wt-1')).toBe(true);
		worktreeExpanded.clear();
		expect(worktreeExpanded.tryBegin('wt-1')).toBe(true);
	});
});
