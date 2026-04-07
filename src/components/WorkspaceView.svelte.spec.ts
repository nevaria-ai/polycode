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

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			await expect.element(page.getByText('main')).toBeInTheDocument();
			await expect.element(page.getByText('feature/test')).toBeInTheDocument();
		});

		it('displays detached head for null branch', async () => {
			const mockWorktrees: WorktreeEntry[] = [{ path: '/test/project/detached', branch: null }];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			await expect.element(page.getByText('(detached)')).toBeInTheDocument();
		});

		it('shows empty state when no worktrees found', async () => {
			render(WorkspaceView, {
				worktrees: [],
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			await expect.element(page.getByText('No worktrees found')).toBeInTheDocument();
		});

		it('shows loading state when worktrees is null', async () => {
			render(WorkspaceView, {
				worktrees: null as unknown as WorktreeEntry[],
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			await expect.element(page.getByText('Loading worktrees...')).toBeInTheDocument();
		});
	});

	describe('Worktree Deletion', () => {
		it('displays delete button inside worktree header', async () => {
			const mockWorktrees: WorktreeEntry[] = [{ path: '/test/project/main', branch: 'main' }];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			// Find the delete button by its aria-label, using exact match
			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await expect.element(deleteButton).toBeInTheDocument();
		});

		it('opens unmerged warning dialog when status is "unmerged"', async () => {
			const mockWorktrees: WorktreeEntry[] = [
				{ path: '/test/project/main', branch: 'main', status: 'unmerged' }
			];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			// Click delete button
			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await deleteButton.click();

			// Warning dialog should appear with unmerged warning
			await expect
				.element(page.getByText(/unmerge changes detected in worktree/i))
				.toBeInTheDocument();
			await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		});

		it('opens uncommitted warning dialog when status is "uncommitted"', async () => {
			const mockWorktrees: WorktreeEntry[] = [
				{ path: '/test/project/main', branch: 'main', status: 'uncommitted' }
			];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			// Click delete button
			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await deleteButton.click();

			// Warning dialog should appear with uncommitted warning
			await expect
				.element(page.getByText(/uncommitted changes detected in worktree/i))
				.toBeInTheDocument();
			await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		});

		it('opens confirmation dialog when status is "clean" and branch is not merged', async () => {
			const mockWorktrees: WorktreeEntry[] = [
				{ path: '/test/project/main', branch: 'feature', status: 'clean', isMerged: false }
			];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			// Click delete button
			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await deleteButton.click();

			// Confirmation dialog should appear without warning
			await expect
				.element(page.getByText('Are you sure you want to delete this worktree?'))
				.toBeInTheDocument();
			await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		});

		it('opens merged info dialog when status is "clean" and branch is merged', async () => {
			const mockWorktrees: WorktreeEntry[] = [
				{ path: '/test/project/main', branch: 'feature', status: 'clean', isMerged: true }
			];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			// Click delete button
			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await deleteButton.click();

			// Dialog should show branch is merged
			await expect
				.element(page.getByText(/This branch has been merged into main/i))
				.toBeInTheDocument();
			await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		});
	});
});
