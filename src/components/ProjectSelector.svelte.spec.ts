import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProjectSelector from './ProjectSelector.svelte';

describe('ProjectSelector', () => {
	it('renders new project button with Plus icon', async () => {
		const screen = render(ProjectSelector);

		const newProjectBtn = screen.getByTitle('New project');
		expect(newProjectBtn).toBeTruthy();
	});

	it('renders project button with initial letter', async () => {
		const screen = render(ProjectSelector);

		const projectBtn = screen.container.querySelector('[data-slot="project-button"]');
		expect(projectBtn).toBeTruthy();
		expect(projectBtn?.textContent?.trim()).toBe('P');
	});

	it('fills background with dimmed project color and text uses full project color', async () => {
		const screen = render(ProjectSelector);

		const projectBtn = screen.container.querySelector(
			'[data-slot="project-button"]'
		) as HTMLElement | null;
		expect(projectBtn).toBeTruthy();
		const rgba = projectBtn!.style.backgroundColor;
		expect(rgba).toContain('rgba');
		expect(projectBtn!.style.color).toBe('rgb(212, 133, 10)');
	});

	it('has minor rounded corners', async () => {
		const screen = render(ProjectSelector);

		const projectBtn = screen.container.querySelector('[data-slot="project-button"]');
		expect(projectBtn).toBeTruthy();
		expect(projectBtn?.className).toContain('rounded-md');
	});

	it('has darker background on hover', async () => {
		const screen = render(ProjectSelector);

		const projectBtn = screen.container.querySelector(
			'[data-slot="project-button"]'
		) as HTMLElement | null;
		expect(projectBtn).toBeTruthy();
		expect(projectBtn!.style.getPropertyValue('--hover-bg')).toBeTruthy();
	});

	it('selected state has dimmed white background and larger text', async () => {
		const screen = render(ProjectSelector);

		const projectBtn = screen.container.querySelector('[data-slot="project-button"]');
		expect(projectBtn).toBeTruthy();
		expect(projectBtn?.className).toContain('aria-selected:bg-white/10');
		expect(projectBtn?.className).toContain('aria-selected:text-lg');
	});
});
