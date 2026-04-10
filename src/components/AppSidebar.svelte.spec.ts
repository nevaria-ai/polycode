import { describe, expect, it, beforeEach, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render, cleanup } from 'vitest-browser-svelte';

const { appPage, setPathname } = vi.hoisted(() => {
	const state = { url: { pathname: '/' } };

	return {
		appPage: state,
		setPathname: (pathname: string) => {
			state.url.pathname = pathname;
		}
	};
});

vi.mock('$app/state', () => ({
	page: appPage
}));

import AppSidebarTestWrapper from './AppSidebarTestWrapper.svelte';

describe('AppSidebar', () => {
	beforeEach(() => {
		localStorage.clear();
		cleanup();
		setPathname('/');
	});

	it('renders in the root layout with no legacy project rail', async () => {
		render(AppSidebarTestWrapper, { sidebarProjects: [] });
		await expect.element(page.getByText('New Session')).toBeInTheDocument();
		await expect.element(page.getByText('Open Project')).toBeInTheDocument();
		await expect.element(page.getByText('Settings')).toBeInTheDocument();
	});

	it('marks New Session as active on the home route', async () => {
		setPathname('/');

		const { container } = render(AppSidebarTestWrapper, { sidebarProjects: [] });

		const newSessionButton = container.querySelector('[data-sidebar="menu-button"]');
		expect(newSessionButton).toBeInTheDocument();
		expect(newSessionButton?.getAttribute('data-active')).toBe('true');
		expect(newSessionButton?.className).toContain('data-active:bg-sidebar-active');
		expect(newSessionButton?.className).toContain('data-active:text-sidebar-active-foreground');
	});

	it('keeps Open Project outside the scrollable tree region', async () => {
		render(AppSidebarTestWrapper, { sidebarProjects: [] });
		const groups = document.querySelectorAll('[data-sidebar="group"]');
		expect(groups).toHaveLength(2);
		expect(groups[1]?.textContent).not.toContain('Open Project');
	});

	it('toggles project expansion on row click', async () => {
		const sidebarProjects = [
			{
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				color: '#fff',
				worktrees: [{ path: '/repo', branch: 'main', sessions: [] }]
			}
		];

		render(AppSidebarTestWrapper, { sidebarProjects });

		await expect.element(page.getByText('acme/repo')).toBeInTheDocument();

		const projectRow = page.getByRole('button', { name: /repo/i });
		await projectRow.click();

		await expect.element(page.getByText('main')).toBeInTheDocument();
	});

	it('keeps project and worktree chevrons hidden until hover/focus styling reveals them', async () => {
		render(AppSidebarTestWrapper, {
			sidebarProjects: [
				{
					name: 'repo',
					displayName: 'acme/repo',
					path: '/repo',
					projectId: 'repo-id',
					color: '#fff',
					worktrees: [{ path: '/repo', branch: 'main', sessions: [] }]
				}
			]
		});

		const chevrons = Array.from(document.querySelectorAll('svg')).filter((icon) =>
			icon.getAttribute('class')?.includes('opacity-0')
		);

		expect(chevrons.length).toBeGreaterThan(0);
	});

	it('shows session rows with two-line titles and smaller styling', async () => {
		render(AppSidebarTestWrapper, {
			sidebarProjects: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					color: '#fff',
					worktrees: [
						{
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 'session-1',
									title: 'A very long session title that should wrap to a second line',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',
									cliProfileId: 'p1',
									createdAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
						}
					]
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();
		(document.querySelector('[aria-label="Expand main branch"]') as HTMLElement | null)?.click();

		const sessionLink = page.getByRole('link', { name: /a very long session title/i });
		await expect.element(sessionLink).toBeInTheDocument();
	});

	it('worktree actions show on hover', async () => {
		render(AppSidebarTestWrapper, {
			sidebarProjects: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					color: '#fff',
					worktrees: [
						{
							path: '/repo',
							branch: 'main',
							sessions: []
						}
					]
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();
		await expect.element(page.getByText('main')).toBeInTheDocument();
	});

	it('keeps row hover styling independent from project and worktree action zones', async () => {
		render(AppSidebarTestWrapper, {
			sidebarProjects: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					color: '#fff',
					worktrees: [
						{
							path: '/repo',
							branch: 'main',
							sessions: []
						}
					]
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();

		const projectMain = document.querySelector('.project-main');
		const projectActions = document.querySelector('.project-actions');
		const projectButton = document.querySelector('[aria-label="Expand repo"]');
		const worktreeMain = document.querySelector('.worktree-main');
		const worktreeActions = document.querySelector('.worktree-actions');
		const worktreeButton = document.querySelector('[aria-label="Expand main branch"]');
		const worktreeDropdownTrigger = worktreeActions?.querySelector(
			'[data-slot="dropdown-menu-trigger"]'
		);

		expect(projectMain?.className).toContain(
			'group-hover/menu-item:text-sidebar-accent-foreground'
		);
		expect(projectMain?.className).toContain(
			'group-focus-within/menu-item:text-sidebar-accent-foreground'
		);
		expect(projectMain?.className).toContain(
			'group-has-[.project-actions:hover]/menu-item:text-sidebar-foreground/90'
		);
		expect(projectActions?.className).toContain('project-actions');
		expect(projectActions?.className).toContain('text-sidebar-foreground/90');
		expect(projectButton?.className).toContain('hover:text-sidebar-accent-foreground');

		expect(worktreeMain?.className).toContain(
			'group-hover/worktree:text-sidebar-accent-foreground'
		);
		expect(worktreeMain?.className).toContain(
			'group-focus-within/worktree:text-sidebar-accent-foreground'
		);
		expect(worktreeMain?.className).toContain(
			'group-has-[.worktree-actions:hover]/worktree:text-sidebar-foreground'
		);
		expect(worktreeMain?.className).toContain(
			'group-has-[.worktree-actions_[data-state=open]]/worktree:text-sidebar-accent-foreground'
		);
		expect(worktreeActions?.className).toContain('worktree-actions');
		expect(worktreeActions?.className).toContain('text-sidebar-foreground');
		expect(worktreeDropdownTrigger).not.toBeNull();
		expect(worktreeButton?.className).toContain(
			'group-has-[.worktree-actions_[data-state=open]]/worktree:bg-sidebar-accent'
		);
		expect(worktreeButton?.className).toContain('hover:text-sidebar-accent-foreground');
	});

	it('project rows and worktree rows are not link-styled', async () => {
		render(AppSidebarTestWrapper, { sidebarProjects: [] });
		const sessionLinks = document.querySelectorAll('a');
		expect(sessionLinks.length).toBe(0);
	});

	it('shows the hide-sidebar tooltip with the shared tooltip styling', async () => {
		render(AppSidebarTestWrapper, { sidebarProjects: [] });

		await page.getByRole('button', { name: 'Hide sidebar' }).nth(1).hover();
		await expect.element(page.getByText('Hide sidebar')).toBeVisible();

		const tooltip = document.querySelector('[data-slot="tooltip-content"]');
		expect(tooltip?.getAttribute('data-side')).toBe('bottom');
		expect(tooltip?.className).toContain('px-3');
		expect(tooltip?.className).toContain('py-1.5');
		expect(tooltip?.className).toContain('bg-foreground');
		expect(tooltip?.className).toContain('text-background');
	});

	it('delays the hide-sidebar tooltip so it does not appear immediately on hover', async () => {
		render(AppSidebarTestWrapper, { sidebarProjects: [] });

		await page.getByRole('button', { name: 'Hide sidebar' }).nth(1).hover();
		expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();

		await new Promise((resolve) => setTimeout(resolve, 450));
		await expect.element(page.getByText('Hide sidebar')).toBeVisible();
	});

	it('has sidebar session rows in the tree', async () => {
		render(AppSidebarTestWrapper, {
			sidebarProjects: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					color: '#fff',
					worktrees: [
						{
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 's1',
									title: 'Test Session',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',
									cliProfileId: 'p1',
									createdAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
						}
					]
				}
			]
		});
		await page.getByRole('button', { name: /repo/i }).click();
		(document.querySelector('[aria-label="Expand main branch"]') as HTMLElement | null)?.click();
		await expect.element(page.getByText('Test Session')).toBeInTheDocument();
	});

	it('marks the flat session route as active', async () => {
		setPathname('/sessions/session-1');

		const { container } = render(AppSidebarTestWrapper, {
			sidebarProjects: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					color: '#fff',
					worktrees: [
						{
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 'session-1',
									title: 'Active Session',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',
									cliProfileId: 'p1',
									createdAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
						}
					]
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();
		(document.querySelector('[aria-label="Expand main branch"]') as HTMLElement | null)?.click();

		const sessionLink = container.querySelector('a[href="/sessions/session-1"]');
		expect(sessionLink).toBeInTheDocument();
		expect(sessionLink?.closest('[data-active="true"]')).toBeInTheDocument();
	});

	it('does not mark nested paths under a session route as active', async () => {
		setPathname('/sessions/session-1/thread');

		const { container } = render(AppSidebarTestWrapper, {
			sidebarProjects: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					color: '#fff',
					worktrees: [
						{
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 'session-1',
									title: 'Active Session',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',
									cliProfileId: 'p1',
									createdAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
						}
					]
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();
		(document.querySelector('[aria-label="Expand main branch"]') as HTMLElement | null)?.click();

		const sessionLink = container.querySelector('a[href="/sessions/session-1"]');
		expect(sessionLink).toBeInTheDocument();
		expect(sessionLink?.closest('[data-active="true"]')).toBeNull();
	});
});
