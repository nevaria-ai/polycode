import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProjectSelector from './ProjectSelector.svelte';
import type { StoredProject } from '$lib/projects';

// Mock SvelteKit's goto
vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

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

describe('ProjectSelector', () => {
	const mockProjects: StoredProject[] = [
		{ name: 'polycode', path: '/tmp/polycode', color: '#d4850a' },
		{ name: 'svelte', path: '/tmp/svelte', color: '#3b82f6' }
	];

	it('renders new project button with Plus icon', async () => {
		const screen = render(ProjectSelector, {
			projects: mockProjects
		});

		const newProjectBtn = screen.getByTitle('New project');
		expect(newProjectBtn).toBeTruthy();
	});

	it('renders project button with initial letter', async () => {
		const screen = render(ProjectSelector, {
			projects: mockProjects
		});

		const projectBtn = screen.container.querySelector('[data-slot="project-button"]');
		expect(projectBtn).toBeTruthy();
		expect(projectBtn?.textContent?.trim()).toBe('P');
	});

	it('fills background with dimmed project color and text uses full project color', async () => {
		const screen = render(ProjectSelector, {
			projects: mockProjects
		});

		const projectBtn = screen.container.querySelector(
			'[data-slot="project-button"]'
		) as HTMLElement | null;
		expect(projectBtn).toBeTruthy();
		const rgba = projectBtn!.style.backgroundColor;
		expect(rgba).toContain('rgba');
		expect(projectBtn!.style.color).toBe('rgb(212, 133, 10)');
	});

	it('has minor rounded corners', async () => {
		const screen = render(ProjectSelector, {
			projects: mockProjects
		});

		const projectBtn = screen.container.querySelector('[data-slot="project-button"]');
		expect(projectBtn).toBeTruthy();
		expect(projectBtn?.className).toContain('rounded-md');
	});

	it('has darker background on hover', async () => {
		const screen = render(ProjectSelector, {
			projects: mockProjects
		});

		const projectBtn = screen.container.querySelector(
			'[data-slot="project-button"]'
		) as HTMLElement | null;
		expect(projectBtn).toBeTruthy();
		expect(projectBtn!.style.getPropertyValue('--hover-bg')).toBeTruthy();
	});

	it('selected state has dimmed white background and larger text', async () => {
		const screen = render(ProjectSelector, {
			projects: mockProjects
		});

		const projectBtn = screen.container.querySelector('[data-slot="project-button"]');
		expect(projectBtn).toBeTruthy();
		expect(projectBtn?.className).toContain('aria-selected:bg-white/10');
		expect(projectBtn?.className).toContain('aria-selected:text-lg');
	});

	it('renders project buttons from loaded server data', async () => {
		const screen = render(ProjectSelector, {
			projects: mockProjects
		});

		// Should find two project buttons with the correct titles
		const projectButtons = screen.container.querySelectorAll('[data-slot="project-button"]');
		expect(projectButtons.length).toBe(2);

		// Check that the buttons have the correct titles
		expect(screen.getByTitle('Open polycode')).toBeTruthy();
		expect(screen.getByTitle('Open svelte')).toBeTruthy();
	});

	it('renders open project dialog button', async () => {
		const screen = render(ProjectSelector, {
			projects: mockProjects
		});

		// Check that the open project button exists
		const openButton = screen.getByTitle('Open project');
		expect(openButton).toBeTruthy();

		// Click the button (dialog is handled by separate component)
		await openButton.click();
	});
});
