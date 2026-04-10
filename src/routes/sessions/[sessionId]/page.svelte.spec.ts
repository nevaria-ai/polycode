import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SessionPage from './+page.svelte';

describe('sessions/[sessionId]/+page.svelte', () => {
	it('renders the current session title inside the page content', async () => {
		const screen = render(SessionPage, {
			data: {
				projects: [],
				sidebarProjects: [],
				cliProfiles: [],
				initialSidebarOpen: true,
				session: {
					id: 'session-12345678',
					cliProfileId: 'profile-1',
					projectId: 'project-1',
					worktreePath: '/repo',
					title: 'Imported conversation layout',
					status: 'active',
					createdAt: '2026-04-10T00:00:00.000Z',
					lastActiveAt: '2026-04-10T00:00:00.000Z'
				}
			}
		});

		expect(screen.getByText('Imported conversation layout')).toBeTruthy();
	});
});
