import { beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import RootLayout from './+layout.svelte';

function renderLayout(props: { initialSidebarOpen: boolean } = { initialSidebarOpen: true }) {
	const children = (() => '') as unknown as Snippet;
	return render(RootLayout, {
		data: { initialSidebarOpen: props.initialSidebarOpen, projectTree: [] },
		children
	});
}

describe('root layout sidebar shell', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('keeps the resizable shell mounted after closing the sidebar', async () => {
		const user = userEvent.setup();
		renderLayout({ initialSidebarOpen: true });

		const paneGroup = document.querySelector('[data-slot="resizable-pane-group"]');
		expect(paneGroup).not.toBeNull();

		const hideBtn = document.querySelector(
			'[data-sidebar="header"] [aria-label="Hide sidebar"]'
		) as HTMLElement | null;
		expect(hideBtn).not.toBeNull();
		await user.click(hideBtn!);

		await waitFor(
			() => {
				expect(document.querySelector('[aria-label="Show sidebar"]')).not.toBeNull();
			},
			{ timeout: 2000 }
		);
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
		const user = userEvent.setup();
		renderLayout({ initialSidebarOpen: true });

		const headerBefore = document.querySelector('[data-testid="content-header"]');
		expect(headerBefore).not.toBeNull();

		const hideBtn = document.querySelector(
			'[data-sidebar="header"] [aria-label="Hide sidebar"]'
		) as HTMLElement | null;
		expect(hideBtn).not.toBeNull();
		await user.click(hideBtn!);

		await waitFor(
			() => {
				expect(document.querySelector('[aria-label="Show sidebar"]')).not.toBeNull();
			},
			{ timeout: 2000 }
		);

		const headerAfter = document.querySelector('[data-testid="content-header"]');
		expect(headerAfter).not.toBeNull();
		expect(headerAfter?.className).toContain('h-12');
	});

	it('renders the app name in the sidebar header', () => {
		renderLayout({ initialSidebarOpen: true });
		const appName = document.querySelector('[data-testid="sidebar-app-name"]');
		expect(appName).not.toBeNull();
		expect(appName?.textContent).toBe('ESK CODE');
	});
});
