import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

const { createProjectMock, listDirectoriesMock, invalidateMock, gotoMock, pageState } = vi.hoisted(
	() => ({
		createProjectMock: vi.fn(async () => ({
			status: 'ok' as const,
			data: { id: 'test-project-id' }
		})),
		listDirectoriesMock: vi.fn(),
		invalidateMock: vi.fn(async () => {}),
		gotoMock: vi.fn(async () => {}),
		pageState: {
			data: {
				projects: [] as Array<{
					id: string;
					path: string;
					createdAt: string;
					displayName: string;
					owner: string | null;
					worktrees: Array<{
						id: string;
						branch: string | null;
						isLinkedWorktree: boolean;
						expandedState: boolean;
						sessions: [];
					}>;
				}>
			}
		}
	})
);

vi.mock('$lib/bindings', () => ({
	commands: {
		createProject: createProjectMock,
		listDirectories: listDirectoriesMock
	}
}));

vi.mock('$app/navigation', () => ({
	invalidate: invalidateMock,
	goto: gotoMock
}));

vi.mock('$app/paths', () => ({
	// In tests, resolve() is the identity function — the app uses relative paths
	// that already start with '/', so no real base-path resolution is needed.
	resolve: (path: string) => path
}));

vi.mock('$app/state', () => ({
	page: pageState
}));

import ProjectSelectorDialog from './ProjectSelectorDialog.svelte';

const PLACEHOLDER = 'e.g. / or ~/Projects/ - add / to list contents';

const manySuggestions = Array.from(
	{ length: 20 },
	(_, index) => `/many/project-${index.toString().padStart(2, '0')}`
);

let scrollIntoViewMock: ReturnType<typeof vi.fn>;

function okDirectories(suggestions: string[], exists = false) {
	return Promise.resolve({
		status: 'ok' as const,
		data: { suggestions, exists }
	});
}

async function pressInputKey(key: string) {
	const input = document.querySelector('[data-slot="input"]') as HTMLInputElement | null;
	if (!input) throw new Error('Expected project input to be mounted');

	input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
	await new Promise((resolve) => requestAnimationFrame(resolve));
}

async function fillPath(user: ReturnType<typeof userEvent.setup>, value: string) {
	const input = screen.getByPlaceholderText(PLACEHOLDER);
	await user.clear(input);
	await user.type(input, value);
}

describe('ProjectSelectorDialog', () => {
	beforeEach(() => {
		// mockReset (not just mockClear) so any lingering mockResolvedValueOnce /
		// mockRejectedValueOnce from a prior test are dropped before re-establishing
		// the default resolved value. Without this, one-shot handlers can leak
		// across tests when the file runs alongside others in the same suite.
		createProjectMock.mockReset();
		createProjectMock.mockResolvedValue({
			status: 'ok' as const,
			data: { id: 'test-project-id' }
		});
		pageState.data.projects = [
			{
				id: 'test-project-id',
				path: '/workspace',
				createdAt: '2026-04-09T10:00:00.000Z',
				displayName: 'workspace',
				owner: null,
				worktrees: [
					{
						id: 'main-wt-id',
						branch: 'main',
						isLinkedWorktree: false,
						expandedState: false,
						sessions: []
					}
				]
			}
		];
		invalidateMock.mockReset();
		invalidateMock.mockResolvedValue();
		gotoMock.mockReset();
		gotoMock.mockResolvedValue();
		scrollIntoViewMock = vi.fn();
		HTMLElement.prototype.scrollIntoView =
			scrollIntoViewMock as unknown as typeof HTMLElement.prototype.scrollIntoView;

		listDirectoriesMock.mockReset();
		listDirectoriesMock.mockImplementation(async (query: string | null) => {
			const q = query ?? '';

			if (q === '/work') {
				return okDirectories(['/workspace', '/worktree']);
			}

			if (q === '/workspace') {
				return okDirectories(['/workspace'], true);
			}

			if (q === '/workspace/') {
				return okDirectories(['/workspace/apps', '/workspace/docs'], true);
			}

			if (q === '/workspac') {
				return okDirectories(['/workspace']);
			}

			if (q === '/does-not-exist') {
				return okDirectories([]);
			}

			if (q === '/server-error') {
				return Promise.reject(new Error('server error'));
			}

			if (q === '/many/') {
				return okDirectories(manySuggestions, true);
			}

			return okDirectories([]);
		});
	});

	it('keeps Open disabled until the typed path exists on disk', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		const openButton = screen.getByRole('button', { name: 'Open' });

		await fillPath(user, '/does-not-exist');
		await waitFor(() => {
			expect(openButton).toBeDisabled();
		});

		await fillPath(user, '/workspace');
		await waitFor(() => {
			expect(openButton).toBeEnabled();
		});
	});

	it('clears cached valid-path state when a later lookup fails', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		const openButton = screen.getByRole('button', { name: 'Open' });

		await fillPath(user, '/workspace');
		await waitFor(() => {
			expect(openButton).toBeEnabled();
		});

		await fillPath(user, '/server-error');
		await waitFor(() => {
			expect(openButton).toBeDisabled();
		});
	});

	it('accepts the highlighted suggestion with Tab and closes the popover', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/work');
		expect(await screen.findByText('/workspace')).toBeVisible();

		await pressInputKey('Tab');

		await waitFor(() => {
			expect(
				(document.querySelector('[data-slot="input"]') as HTMLInputElement | null)?.value
			).toBe('/workspace');
		});
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
		});
	});

	it('reopens suggestions when the user edits the accepted path again', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/work');
		expect(await screen.findByText('/workspace')).toBeVisible();
		await pressInputKey('Tab');

		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
		});

		await fillPath(user, '/workspac');

		expect(await screen.findByText('/workspace')).toBeVisible();
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
		});
	});

	it('clears the picker state when the dialog closes and reopens', async () => {
		const user = userEvent.setup();
		const view = render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/work');
		expect(await screen.findByText('/workspace')).toBeVisible();

		await view.rerender({ open: false });
		await view.rerender({ open: true });

		await waitFor(() => {
			expect(
				(document.querySelector('[data-slot="input"]') as HTMLInputElement | null)?.value ?? ''
			).toBe('');
		});
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
		});
		expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled();
	});

	it('opens directory contents when the user types a slash after accepting a path with Tab', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/work');
		expect(await screen.findByText('/workspace')).toBeVisible();

		await pressInputKey('Tab');
		await fillPath(user, '/workspace/');

		expect(await screen.findByText('/workspace/apps')).toBeVisible();
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
		});
	});

	it('keeps only one highlighted row when keyboard navigation takes over from mouse hover', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/work');
		expect(await screen.findByText('/workspace')).toBeVisible();

		const items = Array.from(
			document.querySelectorAll('[data-slot="command-item"]')
		) as HTMLElement[];
		items[0]?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
		await pressInputKey('ArrowDown');

		expect(items[0]?.getAttribute('data-highlighted')).toBeNull();
		expect(items[1]?.getAttribute('data-highlighted')).toBe('true');
	});

	it('requests scrolling as keyboard navigation moves through long suggestion lists', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/many/');
		expect(await screen.findByText('/many/project-00')).toBeVisible();

		for (let index = 0; index < 12; index += 1) {
			await pressInputKey('ArrowDown');
		}

		await waitFor(() => {
			expect(scrollIntoViewMock.mock.calls.length).toBeGreaterThan(0);
		});
	});

	it('submits via Enter when the suggestion popover is closed', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/workspace');
		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled();
		});

		// Popover must be closed so Enter submits rather than selecting a suggestion.
		// '/workspace' returns exists=true with itself as the only suggestion; accept
		// it via Tab to collapse the popover.
		await pressInputKey('Tab');
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
		});

		// Form.requestSubmit() mirrors how the browser submits a form on Enter in
		// a text input. Synthetic keydown events don't trigger native submission,
		// so drive the form directly at the same API the browser uses.
		const form = document.querySelector('#open-project-form') as HTMLFormElement | null;
		expect(form).not.toBeNull();
		form?.requestSubmit();

		await waitFor(() => {
			expect(createProjectMock).toHaveBeenCalledWith({ path: '/workspace' });
			expect(invalidateMock).toHaveBeenCalledWith('project:tree');
			expect(gotoMock).toHaveBeenCalledWith('/?workspace=main-wt-id');
		});
		// invalidate must run before goto so the layout's projects refresh
		// completes before the composer tries to resolve the selected project.
		expect(invalidateMock.mock.invocationCallOrder[0]).toBeLessThan(
			gotoMock.mock.invocationCallOrder[0]
		);
	});

	it('does not submit on Enter when the suggestion popover is open', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/work');
		expect(await screen.findByText('/workspace')).toBeVisible();
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
		});

		// With the popover open, handleInputKeydown intercepts Enter to select a
		// suggestion; the form-level submit handler is never reached.
		await pressInputKey('Enter');

		expect(createProjectMock).not.toHaveBeenCalled();
	});

	it('triggers submit when the Open button is clicked', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/workspace');
		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled();
		});

		// Close the popover first so its floating layer doesn't intercept the click.
		await pressInputKey('Tab');
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
		});

		await user.click(screen.getByRole('button', { name: 'Open' }));

		await waitFor(() => {
			expect(createProjectMock).toHaveBeenCalledWith({ path: '/workspace' });
		});
	});

	it('navigates to a new session for the returned project id on submit (covers create-new and reuse)', async () => {
		// The backend returns the existing project when the path is already added;
		// since the response shape is identical to a fresh create, the frontend
		// treats both cases the same way: navigate with workspace= for unlinked worktree.
		createProjectMock.mockResolvedValueOnce({
			status: 'ok' as const,
			data: { id: 'reused-existing-id' }
		});
		pageState.data.projects = [
			{
				id: 'reused-existing-id',
				path: '/workspace',
				createdAt: '2026-04-09T10:00:00.000Z',
				displayName: 'workspace',
				owner: null,
				worktrees: [
					{
						id: 'reused-wt-id',
						branch: 'main',
						isLinkedWorktree: false,
						expandedState: false,
						sessions: []
					}
				]
			}
		];

		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/workspace');
		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled();
		});

		await pressInputKey('Tab');
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
		});

		const form = document.querySelector('#open-project-form') as HTMLFormElement | null;
		expect(form).not.toBeNull();
		form?.requestSubmit();

		await waitFor(() => {
			expect(gotoMock).toHaveBeenCalledWith('/?workspace=reused-wt-id');
			expect(invalidateMock).toHaveBeenCalledWith('project:tree');
		});
	});

	it('does not trigger submit when the Cancel button is clicked', async () => {
		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/workspace');
		// Wait for the directory fetch so Tab can accept the highlighted suggestion
		// and close the popover (same race as the Open / Enter submit tests).
		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled();
		});

		// Close the popover first so its floating layer doesn't intercept the click.
		await pressInputKey('Tab');
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
		});

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(createProjectMock).not.toHaveBeenCalled();
	});

	it('URL-encodes the project id when navigating', async () => {
		// Project ids are UUIDs so this is mostly belt-and-suspenders, but the
		// dialog must not blindly concatenate the id into the URL.
		const projectId = 'id with spaces & slashes';
		createProjectMock.mockResolvedValueOnce({
			status: 'ok' as const,
			data: { id: projectId }
		});
		pageState.data.projects = [
			{
				id: projectId,
				path: '/workspace',
				createdAt: '2026-04-09T10:00:00.000Z',
				displayName: 'workspace',
				owner: null,
				worktrees: [
					{
						id: 'encoded-wt-id',
						branch: 'main',
						isLinkedWorktree: false,
						expandedState: false,
						sessions: []
					}
				]
			}
		];

		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/workspace');
		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled();
		});
		await pressInputKey('Tab');
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
		});

		const form = document.querySelector('#open-project-form') as HTMLFormElement | null;
		form?.requestSubmit();

		await waitFor(() => {
			expect(gotoMock).toHaveBeenCalledWith('/?workspace=encoded-wt-id');
		});
	});

	it('does not navigate when createProject rejects', async () => {
		// If the backend errors (e.g. permission denied), the dialog must stay
		// open and surface the error rather than navigating to a phantom session.
		createProjectMock.mockRejectedValueOnce(new Error('permission denied'));

		const user = userEvent.setup();
		render(ProjectSelectorDialog, { open: true });

		await fillPath(user, '/workspace');
		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled();
		});
		await pressInputKey('Tab');
		await waitFor(() => {
			expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
		});

		const form = document.querySelector('#open-project-form') as HTMLFormElement | null;
		form?.requestSubmit();

		expect(await screen.findByText('permission denied')).toBeVisible();
		expect(gotoMock).not.toHaveBeenCalled();
		expect(invalidateMock).not.toHaveBeenCalled();
	});
});
