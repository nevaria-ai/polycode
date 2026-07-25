import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const { deleteWorktreeMock, invalidateMock } = vi.hoisted(() => ({
	deleteWorktreeMock: vi.fn(async () => ({ status: 'ok' as const, data: null })),
	invalidateMock: vi.fn(async () => {})
}));

vi.mock('$lib/bindings', () => ({
	commands: {
		deleteWorktree: deleteWorktreeMock
	}
}));

vi.mock('$app/navigation', () => ({
	invalidate: invalidateMock
}));

import DeleteWorktreeDialog from './DeleteWorktreeDialog.svelte';

const target = {
	projectId: 'proj-1',
	worktreeId: 'wt-1',
	branch: 'feature-x'
};

describe('DeleteWorktreeDialog', () => {
	beforeEach(() => {
		cleanup();
		deleteWorktreeMock.mockReset();
		deleteWorktreeMock.mockResolvedValue({ status: 'ok' as const, data: null });
		invalidateMock.mockReset();
		invalidateMock.mockResolvedValue(undefined);
	});

	it('renders confirmation for the target branch', async () => {
		render(DeleteWorktreeDialog, { info: target });

		await expect.element(page.getByText('Delete Worktree')).toBeInTheDocument();
		await expect.element(page.getByText('feature-x')).toBeInTheDocument();
		await expect
			.element(page.getByText(/dirty or the branch is not fully merged/))
			.toBeInTheDocument();
	});

	it('shows command error and keeps dialog open on delete failure', async () => {
		deleteWorktreeMock.mockRejectedValueOnce(
			new Error("git branch -d failed: the branch 'feature-x' is not fully merged")
		);
		render(DeleteWorktreeDialog, { info: target });

		await page.getByRole('button', { name: 'Delete' }).click();

		await expect
			.element(page.getByText("git branch -d failed: the branch 'feature-x' is not fully merged"))
			.toBeInTheDocument();
		await expect.element(page.getByText('Delete Worktree')).toBeInTheDocument();
		expect(invalidateMock).not.toHaveBeenCalled();
	});

	it('clears error on cancel so reopen does not show a stale message', async () => {
		deleteWorktreeMock.mockRejectedValueOnce(
			new Error('remove worktree failed: contains modified or untracked files, use --force')
		);
		const screen = render(DeleteWorktreeDialog, { info: target });

		await page.getByRole('button', { name: 'Delete' }).click();
		await expect
			.element(
				page.getByText('remove worktree failed: contains modified or untracked files, use --force')
			)
			.toBeInTheDocument();

		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect.element(page.getByText('Delete Worktree')).not.toBeInTheDocument();

		await screen.rerender({ info: { ...target, branch: 'feature-y' } });
		await expect.element(page.getByText('Delete Worktree')).toBeInTheDocument();
		await expect.element(page.getByText('feature-y')).toBeInTheDocument();
		expect(document.body.textContent).not.toContain('remove worktree failed');
	});

	it('closes and invalidates projects:list on successful delete', async () => {
		render(DeleteWorktreeDialog, { info: target });

		await page.getByRole('button', { name: 'Delete' }).click();

		await expect.poll(() => invalidateMock.mock.calls.length).toBe(1);
		expect(deleteWorktreeMock).toHaveBeenCalledWith('proj-1', 'wt-1');
		expect(invalidateMock).toHaveBeenCalledWith('projects:list');
		await expect.element(page.getByText('Delete Worktree')).not.toBeInTheDocument();
	});

	it('uses fallback message when thrown value is not an Error', async () => {
		deleteWorktreeMock.mockRejectedValueOnce('boom');
		render(DeleteWorktreeDialog, { info: target });

		await page.getByRole('button', { name: 'Delete' }).click();

		await expect.element(page.getByText('Failed to delete worktree or branch')).toBeInTheDocument();
		expect(invalidateMock).not.toHaveBeenCalled();
	});
});
