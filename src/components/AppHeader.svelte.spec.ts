import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AppHeader from './AppHeader.svelte';

describe('AppHeader', () => {
	it('shows branding and placeholder context', async () => {
		const screen = render(AppHeader);

		expect(screen.getByText('polycode')).toBeTruthy();
		expect(screen.getByText('No session selected')).toBeTruthy();
	});
});
