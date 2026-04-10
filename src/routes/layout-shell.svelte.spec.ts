import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { Snippet } from 'svelte';
import RootLayout from './+layout.svelte';

describe('root layout sidebar shell', () => {
	beforeEach(() => {
		localStorage.clear();
		cleanup();
	});

	it('keeps the resizable shell mounted after closing the sidebar', async () => {
		const children = (() => '') as unknown as Snippet;

		render(RootLayout, {
			data: { projects: [], cliProfiles: [], initialSidebarOpen: true, sidebarProjects: [] },
			children
		});

		const paneGroup = document.querySelector('[data-slot="resizable-pane-group"]');
		expect(paneGroup).not.toBeNull();

		await page.getByRole('button', { name: 'Hide sidebar' }).nth(1).click();

		await expect.element(page.getByRole('button', { name: 'Show sidebar' })).toBeInTheDocument();
		expect(document.querySelector('[data-slot="resizable-pane-group"]')).toBe(paneGroup);
	});
});
