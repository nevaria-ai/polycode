import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProjectPage from './+page.svelte';

// Mock SvelteKit's enhance
vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({}))
}));

// Mock SvelteKit's page store
vi.mock('$app/state', () => ({
	page: {
		route: { id: '/projects/[projectId]' },
		params: { projectId: 'L1Byb2plY3RzL29wZW5zb3VyY2UtcHJvamVjdHMvcG9seWNvZGU=' }
	}
}));

describe('projects/[projectId]/+page.svelte', () => {
	it('renders the selected project name and path', async () => {
		const screen = render(ProjectPage, {
			data: {
				projects: [],
				cliProfiles: [],
				worktrees: [],
				project: {
					name: 'polycode',
					path: '/Projects/opensource-projects/polycode',
					color: '#d4850a'
				}
			}
		});

		expect(screen.getByText('polycode')).toBeTruthy();
		expect(screen.getByText('/Projects/opensource-projects/polycode')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Close project' })).toBeTruthy();
	});

	it('renders a close form for the project', async () => {
		const screen = render(ProjectPage, {
			data: {
				projects: [],
				cliProfiles: [],
				worktrees: [],
				project: {
					name: 'polycode',
					path: '/Projects/opensource-projects/polycode',
					color: '#d4850a'
				}
			}
		});

		const form = screen.container.querySelector('form[action="/projects/?/close"]');
		expect(form).toBeTruthy();

		const submitButton = screen.container.querySelector('button[type="submit"]');
		expect(submitButton).toBeTruthy();
		expect(submitButton?.textContent).toContain('Close project');
	});

	it('renders not found state when project is null', async () => {
		const screen = render(ProjectPage, {
			data: {
				projects: [],
				cliProfiles: [],
				worktrees: [],
				project: null
			}
		});

		expect(screen.getByText('Project not found')).toBeTruthy();
	});
});
