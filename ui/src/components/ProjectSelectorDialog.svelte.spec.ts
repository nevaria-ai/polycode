import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const { createProjectMock, invalidateAllMock } = vi.hoisted(() => ({
	createProjectMock: vi.fn(async () => ({ project: { id: 'test' } })),
	invalidateAllMock: vi.fn(async () => {})
}));

// Mock $lib/services but pass getDirectories through to the real impl so the
// existing suggestion-flow tests can keep driving it via the globalThis.fetch
// stub in beforeEach. createProject is mocked so submit-behavior tests can
// assert against it directly.
vi.mock('$lib/services', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/services')>();
	return {
		...actual,
		createProject: createProjectMock
	};
});

vi.mock('$app/navigation', () => ({
	invalidateAll: invalidateAllMock
}));

import ProjectSelectorDialog from './ProjectSelectorDialog.svelte';

const manySuggestions = Array.from(
	{ length: 20 },
	(_, index) => `/many/project-${index.toString().padStart(2, '0')}`
);

let scrollIntoViewMock: ReturnType<typeof vi.fn>;

function createFetchResponse(suggestions: string[], exists = false) {
	return Promise.resolve(
		new Response(
			JSON.stringify({
				suggestions,
				exists
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	);
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
		createProjectMock.mockClear();
		invalidateAllMock.mockClear();
		scrollIntoViewMock = vi.fn();
		HTMLElement.prototype.scrollIntoView =
			scrollIntoViewMock as unknown as typeof HTMLElement.prototype.scrollIntoView;

		globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
			const query = new URL(url, 'http://localhost').searchParams.get('q') ?? '';

			if (query === '/work') {
				return createFetchResponse(['/workspace', '/worktree']);
			}

			if (query === '/workspace') {
				return createFetchResponse(['/workspace'], true);
			}

			if (query === '/workspace/') {
				return createFetchResponse(['/workspace/apps', '/workspace/docs'], true);
			}

			if (query === '/workspac') {
				return createFetchResponse(['/workspace']);
			}

			if (query === '/does-not-exist') {
				return createFetchResponse([]);
			}

			if (query === '/server-error') {
				return Promise.resolve(new Response(null, { status: 500 }));
			}

			if (query === '/many/') {
				return createFetchResponse(manySuggestions, true);
			}

			return createFetchResponse([]);
		}) as unknown as typeof fetch;
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
		expect(createProjectMock).toHaveBeenCalledWith('/workspace');
		expect(invalidateAllMock).toHaveBeenCalledTimes(1);
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
		expect(createProjectMock).toHaveBeenCalledWith('/workspace');
	});

	it('does not trigger submit when the Cancel button is clicked', async () => {
		render(ProjectSelectorDialog, { open: true });

		const input = page.getByPlaceholder('e.g. / or ~/Projects/ - add / to list contents');
		await input.fill('/workspace');

		// Close the popover first so its floating layer doesn't intercept the click.
		await pressInputKey('Tab');
		await expect.poll(() => document.querySelector('[data-slot="popover-content"]')).toBeNull();

		await page.getByRole('button', { name: 'Cancel' }).click();

		expect(createProjectMock).not.toHaveBeenCalled();
	});
});
