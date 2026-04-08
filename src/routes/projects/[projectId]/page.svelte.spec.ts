import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProjectPage from './+page.svelte';

describe('projects/[projectId]/+page.svelte', () => {
	it('renders the session prompt message', async () => {
		const screen = render(ProjectPage);

		expect(screen.getByText(/Start a new session or pick a session/)).toBeTruthy();
	});
});
