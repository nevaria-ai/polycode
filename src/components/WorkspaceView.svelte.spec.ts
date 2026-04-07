import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import WorkspaceView from './WorkspaceView.svelte';
import type { WorktreeEntry } from '$lib/server/git';

describe('WorkspaceView', () => {
	describe('Worktree Display', () => {
		it('displays worktrees as groups', async () => {
			const mockWorktrees: WorktreeEntry[] = [
				{ path: '/test/project/main', branch: 'main' },
				{ path: '/test/project/feature', branch: 'feature/test' }
			];

			render(WorkspaceView, { worktrees: mockWorktrees, projectPath: '/test/project' });

			await expect.element(page.getByText('main')).toBeInTheDocument();
			await expect.element(page.getByText('feature/test')).toBeInTheDocument();
		});

		it('displays detached head for null branch', async () => {
			const mockWorktrees: WorktreeEntry[] = [{ path: '/test/project/detached', branch: null }];

			render(WorkspaceView, { worktrees: mockWorktrees, projectPath: '/test/project' });

			await expect.element(page.getByText('(detached)')).toBeInTheDocument();
		});

		it('shows empty state when no worktrees found', async () => {
			render(WorkspaceView, { worktrees: [], projectPath: '/test/project' });

			await expect.element(page.getByText('No worktrees found')).toBeInTheDocument();
		});

		it('shows loading state when worktrees is null', async () => {
			render(WorkspaceView, {
				worktrees: null as unknown as WorktreeEntry[],
				projectPath: '/test/project'
			});

			await expect.element(page.getByText('Loading worktrees...')).toBeInTheDocument();
		});
	});

	describe('Worktree Deletion', () => {
		it('displays delete button inside worktree header', async () => {
			const mockWorktrees: WorktreeEntry[] = [{ path: '/test/project/main', branch: 'main' }];

			render(WorkspaceView, { worktrees: mockWorktrees, projectPath: '/test/project' });

			// Find the delete button by its aria-label, using exact match
			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await expect.element(deleteButton).toBeInTheDocument();
		});

		it('opens warning dialog when delete button is clicked', async () => {
			const mockWorktrees: WorktreeEntry[] = [{ path: '/test/project/main', branch: 'main' }];

			render(WorkspaceView, { worktrees: mockWorktrees, projectPath: '/test/project' });

			// Click delete button
			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await deleteButton.click();

			// Warning dialog should appear
			await expect.element(page.getByText(/unmerge changes detected in worktree/i)).toBeInTheDocument();
			await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		});
	});
});
