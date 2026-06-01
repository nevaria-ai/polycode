import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { SettingsDialog } from './index.js';

describe('SettingsDialog', () => {
	it('renders the Models section', async () => {
		render(SettingsDialog, {
			open: true
		});

		await expect.element(page.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
		await expect.element(page.getByText('Model settings are coming soon.')).toBeInTheDocument();
	});
});
