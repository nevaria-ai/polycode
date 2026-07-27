import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

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
		deleteWorktreeMock.mockReset();
		deleteWorktreeMock.mockResolvedValue({ status: 'ok' as const, data: null });
		invalidateMock.mockReset();
		invalidateMock.mockResolvedValue(undefined);
	});

	it('renders confirmation for the target branch', () => {
		render(DeleteWorktreeDialog, { info: target });

		expect(screen.getByText('Delete Worktree')).toBeInTheDocument();
		expect(screen.getByText('feature-x')).toBeInTheDocument();
		expect(screen.getByText(/dirty or the branch is not fully merged/)).toBeInTheDocument();
	});

	it('shows command error and keeps dialog open on delete failure', async () => {
		const user = userEvent.setup();
		deleteWorktreeMock.mockRejectedValueOnce(
			new Error("git branch -d failed: the branch 'feature-x' is not fully merged")
		);
		render(DeleteWorktreeDialog, { info: target });

		await user.click(screen.getByRole('button', { name: 'Delete' }));

		expect(
			await screen.findByText("git branch -d failed: the branch 'feature-x' is not fully merged")
		).toBeInTheDocument();
		expect(screen.getByText('Delete Worktree')).toBeInTheDocument();
		expect(invalidateMock).not.toHaveBeenCalled();
	});

	it('clears error on cancel so reopen does not show a stale message', async () => {
		const user = userEvent.setup();
		deleteWorktreeMock.mockRejectedValueOnce(
			new Error('remove worktree failed: contains modified or untracked files, use --force')
		);
		const view = render(DeleteWorktreeDialog, { info: target });

		await user.click(screen.getByRole('button', { name: 'Delete' }));
		expect(
			await screen.findByText(
				'remove worktree failed: contains modified or untracked files, use --force'
			)
		).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		await waitFor(() => {
			expect(screen.queryByText('Delete Worktree')).not.toBeInTheDocument();
		});

		await view.rerender({ info: { ...target, branch: 'feature-y' } });
		expect(await screen.findByText('Delete Worktree')).toBeInTheDocument();
		expect(screen.getByText('feature-y')).toBeInTheDocument();
		expect(document.body.textContent).not.toContain('remove worktree failed');
	});

	it('closes and invalidates projects:list on successful delete', async () => {
		const user = userEvent.setup();
		render(DeleteWorktreeDialog, { info: target });

		await user.click(screen.getByRole('button', { name: 'Delete' }));

		await waitFor(() => {
			expect(invalidateMock).toHaveBeenCalledTimes(1);
		});
		expect(deleteWorktreeMock).toHaveBeenCalledWith('proj-1', 'wt-1');
		expect(invalidateMock).toHaveBeenCalledWith('projects:list');
		await waitFor(() => {
			expect(screen.queryByText('Delete Worktree')).not.toBeInTheDocument();
		});
	});

	it('uses fallback message when thrown value is not an Error', async () => {
		const user = userEvent.setup();
		deleteWorktreeMock.mockRejectedValueOnce('boom');
		render(DeleteWorktreeDialog, { info: target });

		await user.click(screen.getByRole('button', { name: 'Delete' }));

		expect(await screen.findByText('Failed to delete worktree or branch')).toBeInTheDocument();
		expect(invalidateMock).not.toHaveBeenCalled();
	});
});
