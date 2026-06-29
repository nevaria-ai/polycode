import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { Snippet } from 'svelte';
import RootLayout from './+layout.svelte';

function renderLayout(props: { initialSidebarOpen: boolean } = { initialSidebarOpen: true }) {
	const children = (() => '') as unknown as Snippet;
	return render(RootLayout, {
		data: { projects: [], initialSidebarOpen: props.initialSidebarOpen, projectTree: [] },
		children
	});
}

describe('root layout sidebar shell', () => {
	beforeEach(() => {
		localStorage.clear();
		cleanup();
	});

	it('keeps the resizable shell mounted after closing the sidebar', async () => {
		renderLayout({ initialSidebarOpen: true });

		const paneGroup = document.querySelector('[data-slot="resizable-pane-group"]');
		expect(paneGroup).not.toBeNull();

		await page.getByRole('button', { name: 'Hide sidebar' }).nth(1).click();

		await expect
			.poll(() => document.querySelector('[data-slot="button"][aria-label="Show sidebar"]'))
			.not.toBeNull();
		expect(document.querySelector('[data-slot="resizable-pane-group"]')).toBe(paneGroup);
	});

	it('always renders the persistent content-side header', () => {
		renderLayout({ initialSidebarOpen: true });
		const header = document.querySelector('[data-testid="content-header"]');
		expect(header).not.toBeNull();
		expect(header?.className).toContain('h-12');
	});

	it('always renders the file icon placeholder in the content header', () => {
		renderLayout({ initialSidebarOpen: true });
		const placeholder = document.querySelector('[data-testid="content-header-placeholder"]');
		expect(placeholder).not.toBeNull();
		expect(placeholder?.querySelector('svg')).not.toBeNull();
	});

	it('does not show the Show sidebar button while the sidebar is open', () => {
		renderLayout({ initialSidebarOpen: true });
		expect(document.querySelector('[aria-label="Show sidebar"]')).toBeNull();
	});

	it('shows the Show sidebar button in the content header when the sidebar starts closed', () => {
		renderLayout({ initialSidebarOpen: false });
		const header = document.querySelector('[data-testid="content-header"]');
		const showBtn = document.querySelector('[aria-label="Show sidebar"]');
		expect(showBtn).not.toBeNull();
		expect(header?.contains(showBtn)).toBe(true);
	});

	it('keeps the content header mounted across open and closed states', async () => {
		renderLayout({ initialSidebarOpen: true });

		const headerBefore = document.querySelector('[data-testid="content-header"]');
		expect(headerBefore).not.toBeNull();

		await page.getByRole('button', { name: 'Hide sidebar' }).nth(1).click();

		await expect.poll(() => document.querySelector('[aria-label="Show sidebar"]')).not.toBeNull();

		const headerAfter = document.querySelector('[data-testid="content-header"]');
		expect(headerAfter).not.toBeNull();
		expect(headerAfter?.className).toContain('h-12');
	});

	it('renders the app name in the sidebar header', () => {
		renderLayout({ initialSidebarOpen: true });
		const appName = document.querySelector('[data-testid="sidebar-app-name"]');
		expect(appName).not.toBeNull();
		expect(appName?.textContent).toBe('POLYCODE');
	});
});
