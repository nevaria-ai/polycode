import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

vi.mock('$lib/api/client', () => ({
	createProject: vi.fn(async () => ({ project: { id: 'test' }, worktree: { id: 'wt' } })),
	isApiError: vi.fn((r: unknown) => typeof r === 'object' && r !== null && 'error' in r),
	listProjects: vi.fn(async () => []),
	listSessions: vi.fn(async () => []),
	closeProject: vi.fn(async () => undefined),
	createSession: vi.fn(async () => ({ session: {} })),
	getSession: vi.fn(async () => ({})),
	deleteSession: vi.fn(async () => undefined),
	updateSessionTitle: vi.fn(async () => ({ session: {} })),
	archiveSession: vi.fn(async () => ({ session: {} })),
	listMessages: vi.fn(async () => []),
	sendMessage: vi.fn(async () => undefined),
	listWorktrees: vi.fn(async () => []),
	createWorktree: vi.fn(async () => ({ worktree: {} })),
	renameWorktree: vi.fn(async () => undefined),
	deleteWorktree: vi.fn(async () => undefined),
	getDirectories: vi.fn(async () => ({ suggestions: [], exists: false }))
}));

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn(async () => {})
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
});
