import { describe, expect, it, vi, beforeEach } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import WorkspaceView from './WorkspaceView.svelte';
import type { WorktreeWithSessions } from '$lib/sessions';

// Mock SvelteKit's enhance
vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({}))
}));

describe('WorkspaceView', () => {
	describe('Worktree Display', () => {
		it('displays worktrees as groups', async () => {
			const mockWorktrees: WorktreeWithSessions[] = [
				{ path: '/test/project/main', branch: 'main', sessions: [] },
				{ path: '/test/project/feature', branch: 'feature/test', sessions: [] }
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
			const mockWorktrees: WorktreeWithSessions[] = [
				{ path: '/test/project/detached', branch: null, sessions: [] }
			];

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
				worktrees: null as unknown as WorktreeWithSessions[],
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			await expect.element(page.getByText('Loading worktrees...')).toBeInTheDocument();
		});
	});

	describe('Session Display', () => {
		beforeEach(() => {
			localStorage.clear();
		});

		it('renders sessions under their worktree with auto-numbered titles', async () => {
			const mockWorktrees: WorktreeWithSessions[] = [
				{
					path: '/test/project/main',
					branch: 'main',
					sessions: [
						{
							id: 's1',
							cliProfileId: 'p1',
							projectId: 'test-project-id',
							worktreePath: '/test/project/main',
							title: null,
							status: 'active',
							createdAt: '2026-04-08T10:00:00.000Z',
							lastActiveAt: '2026-04-08T10:00:00.000Z'
						},
						{
							id: 's2',
							cliProfileId: 'p1',
							projectId: 'test-project-id',
							worktreePath: '/test/project/main',
							title: null,
							status: 'active',
							createdAt: '2026-04-08T11:00:00.000Z',
							lastActiveAt: '2026-04-08T11:00:00.000Z'
						}
					]
				}
			];

			const screen = render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			// Expand the worktree first
			(screen.container.querySelector('[role="button"]') as HTMLElement | null)?.click();

			await expect.element(page.getByText('Session 1')).toBeInTheDocument();
			await expect.element(page.getByText('Session 2')).toBeInTheDocument();
		});

		it('renders sessions with custom titles', async () => {
			const mockWorktrees: WorktreeWithSessions[] = [
				{
					path: '/test/project/main',
					branch: 'main',
					sessions: [
						{
							id: 's1',
							cliProfileId: 'p1',
							projectId: 'test-project-id',
							worktreePath: '/test/project/main',
							title: 'Fix auth bug',
							status: 'active',
							createdAt: '2026-04-08T10:00:00.000Z',
							lastActiveAt: '2026-04-08T10:00:00.000Z'
						}
					]
				}
			];

			const screen = render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			// Expand the worktree
			const worktreeRow = screen.container.querySelector('[role="button"]');
			worktreeRow?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

			await expect.element(page.getByText('Fix auth bug')).toBeInTheDocument();
		});

		it('shows rename and remove buttons on session hover', async () => {
			const mockWorktrees: WorktreeWithSessions[] = [
				{
					path: '/test/project/main',
					branch: 'main',
					sessions: [
						{
							id: 's1',
							cliProfileId: 'p1',
							projectId: 'test-project-id',
							worktreePath: '/test/project/main',
							title: null,
							status: 'active',
							createdAt: '2026-04-08T10:00:00.000Z',
							lastActiveAt: '2026-04-08T10:00:00.000Z'
						}
					]
				}
			];

			const screen = render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			// Expand the worktree first
			(screen.container.querySelector('[role="button"]') as HTMLElement | null)?.click();

			const renameButton = page.getByRole('button', { name: 'Rename session', exact: true });
			await expect.element(renameButton).toBeInTheDocument();

			const removeButton = page.getByRole('button', { name: 'Remove session', exact: true });
			await expect.element(removeButton).toBeInTheDocument();
		});
	});

	describe('Session Removal', () => {
		beforeEach(() => {
			localStorage.clear();
		});

		it('opens remove session confirmation dialog', async () => {
			const mockWorktrees: WorktreeWithSessions[] = [
				{
					path: '/test/project/main',
					branch: 'main',
					sessions: [
						{
							id: 's1',
							cliProfileId: 'p1',
							projectId: 'test-project-id',
							worktreePath: '/test/project/main',
							title: 'Fix auth bug',
							status: 'active',
							createdAt: '2026-04-08T10:00:00.000Z',
							lastActiveAt: '2026-04-08T10:00:00.000Z'
						}
					]
				}
			];

			const screen = render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			// Expand the worktree
			(screen.container.querySelector('[role="button"]') as HTMLElement | null)?.click();

			// Click the remove button
			const removeButton = page.getByRole('button', { name: 'Remove session', exact: true });
			await removeButton.click();

			await expect.element(page.getByText('Remove Session')).toBeInTheDocument();
			await expect
				.element(page.getByText(/remove the session from your list/i))
				.toBeInTheDocument();
			await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		});
	});

	describe('Worktree Deletion', () => {
		it('displays delete button inside worktree header', async () => {
			const mockWorktrees: WorktreeWithSessions[] = [
				{ path: '/test/project/main', branch: 'main', sessions: [] }
			];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await expect.element(deleteButton).toBeInTheDocument();
		});

		it('opens unmerged warning dialog when status is "unmerged"', async () => {
			const mockWorktrees: WorktreeWithSessions[] = [
				{ path: '/test/project/main', branch: 'main', status: 'unmerged', sessions: [] }
			];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await deleteButton.click();

			await expect
				.element(page.getByText(/unmerge changes detected in worktree/i))
				.toBeInTheDocument();
			await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		});

		it('opens uncommitted warning dialog when status is "uncommitted"', async () => {
			const mockWorktrees: WorktreeWithSessions[] = [
				{ path: '/test/project/main', branch: 'main', status: 'uncommitted', sessions: [] }
			];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await deleteButton.click();

			await expect
				.element(page.getByText(/uncommitted changes detected in worktree/i))
				.toBeInTheDocument();
			await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		});

		it('opens confirmation dialog when status is "clean" and branch is not merged', async () => {
			const mockWorktrees: WorktreeWithSessions[] = [
				{
					path: '/test/project/main',
					branch: 'feature',
					status: 'clean',
					isMerged: false,
					sessions: []
				}
			];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await deleteButton.click();

			await expect
				.element(page.getByText('This worktree may contain unpushed or unrecoverable changes.'))
				.toBeInTheDocument();
			await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		});

		it('opens merged info dialog when status is "clean" and branch is merged', async () => {
			const mockWorktrees: WorktreeWithSessions[] = [
				{
					path: '/test/project/main',
					branch: 'feature',
					status: 'clean',
					isMerged: true,
					sessions: []
				}
			];

			render(WorkspaceView, {
				worktrees: mockWorktrees,
				projectPath: '/test/project',
				projectId: 'test-project-id'
			});

			const deleteButton = page.getByRole('button', { name: 'Delete worktree', exact: true });
			await deleteButton.click();

			await expect
				.element(page.getByText(/This branch appears to be fully merged/i))
				.toBeInTheDocument();
			await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		});
	});
});
