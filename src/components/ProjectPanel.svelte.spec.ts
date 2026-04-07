import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ProjectPanel from './ProjectPanel.svelte';
import type { StoredProject } from '$lib/projects';

// All mocks must be at top level without external variables
vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({}))
}));

vi.mock('$app/state', () => ({
	page: {
		route: { id: '/projects/[projectId]' },
		params: { projectId: 'L3RtcC9wb2x5Y29kZQ==' } // /tmp/polycode in base64url
	}
}));

describe('ProjectPanel', () => {
	const mockProjects: StoredProject[] = [
		{ name: 'polycode', path: '/tmp/polycode', color: '#d4850a' },
		{ name: 'svelte', path: '/tmp/svelte', color: '#3b82f6' }
	];

	describe('Project Button Rendering', () => {
		it('renders project buttons with correct data', async () => {
			render(ProjectPanel, { projects: mockProjects });

			await expect.element(page.getByText('P')).toBeInTheDocument();
			await expect.element(page.getByText('S')).toBeInTheDocument();
		});

		it('highlights currently active project', async () => {
			render(ProjectPanel, { projects: mockProjects });

			await expect.element(page.getByTitle('Currently viewing polycode')).toBeInTheDocument();
		});
	});

	describe('New Project Button', () => {
		it('renders new project button with Plus icon', async () => {
			render(ProjectPanel, { projects: mockProjects });

			await expect.element(page.getByTitle('Open project')).toBeInTheDocument();
		});
	});

	describe('Empty State', () => {
		it('shows only new project button when no projects exist', async () => {
			render(ProjectPanel, { projects: [] });

			// Should have new project button
			await expect.element(page.getByTitle('Open project')).toBeInTheDocument();

			// Should not have any project buttons
			const projectButtons = document.querySelectorAll('[data-slot="project-button"]');
			expect(projectButtons.length).toBe(0);
		});
	});
});
