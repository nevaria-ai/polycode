import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AppHeader from './AppHeader.svelte';

// Mock SvelteKit's page store
vi.mock('$app/state', () => ({
	page: {
		route: { id: '/' },
		params: {},
		url: new URL('http://localhost')
	}
}));

describe('AppHeader', () => {
	it('renders without errors', async () => {
		const { container } = render(AppHeader);
		expect(container).toBeTruthy();
	});

	it('displays branding elements', async () => {
		const { container } = render(AppHeader);

		// Check for the accent dots
		const dots = container.querySelectorAll('.rounded-full');
		expect(dots.length).toBeGreaterThan(0);

		// Check for polycode text
		const header = container.querySelector('header');
		expect(header?.textContent).toContain('polycode');
	});

	it('has placeholder for actions', async () => {
		const { container } = render(AppHeader);

		const header = container.querySelector('header');
		expect(header?.textContent).toContain('Actions later');
	});
});
