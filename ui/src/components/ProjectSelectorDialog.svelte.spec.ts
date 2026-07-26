import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const { createProjectMock, listDirectoriesMock, invalidateMock, gotoMock } = vi.hoisted(() => ({
	createProjectMock: vi.fn(async () => ({
		status: 'ok' as const,
		data: { id: 'test-project-id' }
	})),
	listDirectoriesMock: vi.fn(),
	invalidateMock: vi.fn(async () => {}),
	gotoMock: vi.fn(async () => {})
}));

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

import ProjectSelectorDialog from './ProjectSelectorDialog.svelte';

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

describe('ProjectSelectorDialog', () => {
	beforeEach(() => {
		cleanup();
		// mockReset (not just mockClear) so any lingering mockResolvedValueOnce /
		// mockRejectedValueOnce from a prior test are dropped before re-establishing
		// the default resolved value. Without this, one-shot handlers can leak
		// across tests when the file runs alongside others in the same suite.
		createProjectMock.mockReset();
		createProjectMock.mockResolvedValue({
			status: 'ok' as const,
			data: { id: 'test-project-id' }
		});
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
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		const openButton = page.getByRole('button', { name: 'Open' });

		await input.fill('/does-not-exist');
		await expect.element(openButton).toBeDisabled();

		await input.fill('/workspace');
		await expect.element(openButton).toBeEnabled();
	});

	it('clears cached valid-path state when a later lookup fails', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		const openButton = page.getByRole('button', { name: 'Open' });

		await input.fill('/workspace');
		await expect.element(openButton).toBeEnabled();

		await input.fill('/server-error');
		await expect.element(openButton).toBeDisabled();
	});

	it('accepts the highlighted suggestion with Tab and closes the popover', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');

		await input.fill('/work');
		await expect.element(page.getByText('/workspace')).toBeVisible();

		await pressInputKey('Tab');

		await expect
			.poll(() => (document.querySelector('[data-slot="input"]') as HTMLInputElement | null)?.value)
			.toBe('/workspace');
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).toBeNull();
	});

	it('reopens suggestions when the user edits the accepted path again', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');

		await input.fill('/work');
		await expect.element(page.getByText('/workspace')).toBeVisible();
		await pressInputKey('Tab');

		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).toBeNull();

		await input.fill('/workspac');

		await expect.element(page.getByText('/workspace')).toBeVisible();
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
	});

	it('clears the picker state when the dialog closes and reopens', async () => {
		const view = render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/work');
		await expect.element(page.getByText('/workspace')).toBeVisible();

		await view.rerender({ open: false });
		await view.rerender({ open: true });

		await expect
			.poll(
				() =>
					(document.querySelector('[data-slot="input"]') as HTMLInputElement | null)?.value ?? ''
			)
			.toBe('');
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).toBeNull();
		await expect.element(page.getByRole('button', { name: 'Open' })).toBeDisabled();
	});

	it('opens directory contents when the user types a slash after accepting a path with Tab', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/work');
		await expect.element(page.getByText('/workspace')).toBeVisible();

		await pressInputKey('Tab');
		await input.fill('/workspace/');

		await expect.element(page.getByText('/workspace/apps')).toBeVisible();
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
	});

	it('keeps only one highlighted row when keyboard navigation takes over from mouse hover', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/work');
		await expect.element(page.getByText('/workspace')).toBeVisible();

		const items = Array.from(
			document.querySelectorAll('[data-slot="command-item"]')
		) as HTMLElement[];
		items[0]?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
		await pressInputKey('ArrowDown');

		expect(items[0]?.getAttribute('data-highlighted')).toBeNull();
		expect(items[1]?.getAttribute('data-highlighted')).toBe('true');
	});

	it('requests scrolling as keyboard navigation moves through long suggestion lists', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');

		await input.fill('/many/');
		await expect.element(page.getByText('/many/project-00')).toBeVisible();

		for (let index = 0; index < 12; index += 1) {
			await pressInputKey('ArrowDown');
		}

		await expect.poll(() => scrollIntoViewMock.mock.calls.length).toBeGreaterThan(0);
	});

	it('submits via Enter when the suggestion popover is closed', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/workspace');
		await expect.element(page.getByRole('button', { name: 'Open' })).toBeEnabled();

		// Popover must be closed so Enter submits rather than selecting a suggestion.
		// '/workspace' returns exists=true with itself as the only suggestion; accept
		// it via Tab to collapse the popover.
		await pressInputKey('Tab');
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).toBeNull();

		// Form.requestSubmit() mirrors how the browser submits a form on Enter in
		// a text input. Synthetic keydown events don't trigger native submission,
		// so drive the form directly at the same API the browser uses.
		const form = document.querySelector('#open-project-form') as HTMLFormElement | null;
		expect(form).not.toBeNull();
		form?.requestSubmit();

		await expect.poll(() => createProjectMock.mock.calls.length).toBe(1);
		expect(createProjectMock).toHaveBeenCalledWith({ path: '/workspace' });
		expect(invalidateMock).toHaveBeenCalledWith('projects:list');
		expect(gotoMock).toHaveBeenCalledWith('/?project=test-project-id');
		// invalidate must run before goto so the layout's projectTree refresh
		// completes before the composer tries to resolve the selected project.
		expect(invalidateMock.mock.invocationCallOrder[0]).toBeLessThan(
			gotoMock.mock.invocationCallOrder[0]
		);
	});

	it('does not submit on Enter when the suggestion popover is open', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/work');
		await expect.element(page.getByText('/workspace')).toBeVisible();
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).not.toBeNull();

		// With the popover open, handleInputKeydown intercepts Enter to select a
		// suggestion; the form-level submit handler is never reached.
		await pressInputKey('Enter');

		expect(createProjectMock).not.toHaveBeenCalled();
	});

	it('triggers submit when the Open button is clicked', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/workspace');
		await expect.element(page.getByRole('button', { name: 'Open' })).toBeEnabled();

		// Close the popover first so its floating layer doesn't intercept the click.
		await pressInputKey('Tab');
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).toBeNull();

		await page.getByRole('button', { name: 'Open' }).click();

		await expect.poll(() => createProjectMock.mock.calls.length).toBe(1);
		expect(createProjectMock).toHaveBeenCalledWith({ path: '/workspace' });
	});

	it('navigates to a new session for the returned project id on submit (covers create-new and reuse)', async () => {
		// The backend returns the existing project when the path is already added;
		// since the response shape is identical to a fresh create, the frontend
		// treats both cases the same way: navigate to /?project=<id>.
		createProjectMock.mockResolvedValueOnce({
			status: 'ok' as const,
			data: { id: 'reused-existing-id' }
		});

		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/workspace');
		await expect.element(page.getByRole('button', { name: 'Open' })).toBeEnabled();

		await pressInputKey('Tab');
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).toBeNull();

		const form = document.querySelector('#open-project-form') as HTMLFormElement | null;
		expect(form).not.toBeNull();
		form?.requestSubmit();

		await expect.poll(() => gotoMock.mock.calls.length).toBe(1);
		expect(gotoMock).toHaveBeenCalledWith('/?project=reused-existing-id');
		expect(invalidateMock).toHaveBeenCalledWith('projects:list');
	});

	it('does not trigger submit when the Cancel button is clicked', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/workspace');
		// Wait for the directory fetch so Tab can accept the highlighted suggestion
		// and close the popover (same race as the Open / Enter submit tests).
		await expect.element(page.getByRole('button', { name: 'Open' })).toBeEnabled();

		// Close the popover first so its floating layer doesn't intercept the click.
		await pressInputKey('Tab');
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).toBeNull();

		await page.getByRole('button', { name: 'Cancel' }).click();

		expect(createProjectMock).not.toHaveBeenCalled();
	});

	it('URL-encodes the project id when navigating', async () => {
		// Project ids are UUIDs so this is mostly belt-and-suspenders, but the
		// dialog must not blindly concatenate the id into the URL.
		createProjectMock.mockResolvedValueOnce({
			status: 'ok' as const,
			data: { id: 'id with spaces & slashes' }
		});

		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/workspace');
		await expect.element(page.getByRole('button', { name: 'Open' })).toBeEnabled();
		await pressInputKey('Tab');
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).toBeNull();

		const form = document.querySelector('#open-project-form') as HTMLFormElement | null;
		form?.requestSubmit();

		await expect.poll(() => gotoMock.mock.calls.length).toBe(1);
		expect(gotoMock).toHaveBeenCalledWith('/?project=id%20with%20spaces%20%26%20slashes');
	});

	it('does not navigate when createProject rejects', async () => {
		// If the backend errors (e.g. permission denied), the dialog must stay
		// open and surface the error rather than navigating to a phantom session.
		createProjectMock.mockRejectedValueOnce(new Error('permission denied'));

		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/workspace');
		await expect.element(page.getByRole('button', { name: 'Open' })).toBeEnabled();
		await pressInputKey('Tab');
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).toBeNull();

		const form = document.querySelector('#open-project-form') as HTMLFormElement | null;
		form?.requestSubmit();

		await expect.element(page.getByText('permission denied')).toBeVisible();
		expect(gotoMock).not.toHaveBeenCalled();
		expect(invalidateMock).not.toHaveBeenCalled();
	});
});
