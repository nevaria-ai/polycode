import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

const { appPage, setPathname, closeProjectMock } = vi.hoisted(() => {
	const state = { url: { pathname: '/' } };

	return {
		appPage: state,
		setPathname: (pathname: string) => {
			state.url.pathname = pathname;
		},
		closeProjectMock: vi.fn(async () => ({ status: 'ok' as const, data: null }))
	};
});

vi.mock('$app/state', () => ({
	page: appPage
}));

vi.mock('$lib/bindings', () => ({
	commands: {
		closeProject: closeProjectMock,
		updateWorktreeExpandedState: vi.fn(async () => ({ status: 'ok' as const, data: null }))
	}
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async () => {}),
	invalidate: vi.fn(async () => {}),
	replaceState: vi.fn()
}));

import AppSidebarTestWrapper from './AppSidebarTestWrapper.svelte';
import { commands } from '$lib/bindings';
import { invalidate } from '$app/navigation';
import { worktreeExpanded } from '$lib/worktree-expanded.svelte';

describe('AppSidebar', () => {
	beforeEach(() => {
		localStorage.clear();
		worktreeExpanded.clear();
		setPathname('/');
		vi.clearAllMocks();
	});

	it('renders in the root layout with no legacy project rail', () => {
		render(AppSidebarTestWrapper, { projects: [] });
		expect(screen.getByText('New Session')).toBeInTheDocument();
		expect(screen.getByText('Open Project')).toBeInTheDocument();
		expect(screen.getByText('Settings')).toBeInTheDocument();
	});

	it('marks New Session as active on the home route', () => {
		setPathname('/');

		const { container } = render(AppSidebarTestWrapper, { projects: [] });

		const newSessionButton = container.querySelector('[data-sidebar="menu-button"]');
		expect(newSessionButton).toBeInTheDocument();
		expect(newSessionButton?.getAttribute('data-active')).toBe('true');
		expect(newSessionButton?.className).toContain('data-active:bg-sidebar-active');
		expect(newSessionButton?.className).toContain('data-active:text-sidebar-active-foreground');
	});

	it('places Open Project in the scrollable tree region header', () => {
		render(AppSidebarTestWrapper, { projects: [] });
		const groups = document.querySelectorAll('[data-sidebar="group"]');
		expect(groups).toHaveLength(2);
		expect(groups[1]?.textContent).toContain('Open Project');
	});

	it('toggles expansion via updateWorktreeExpandedState without invalidating project:tree', async () => {
		const user = userEvent.setup();
		const projects = [
			{
				displayName: 'acme/repo',
				owner: 'acme',
				path: '/repo',
				id: 'repo-id',
				createdAt: '2026-04-09T10:00:00.000Z',
				worktrees: [
					{
						id: 'test-wt-id',
						branch: 'main',
						isLinkedWorktree: false,
						expandedState: false,
						sessions: []
					}
				]
			}
		];

		render(AppSidebarTestWrapper, { projects });

		expect(screen.getByRole('button', { name: /repo/i })).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /repo/i }));

		expect(await screen.findByText(/main/)).toBeInTheDocument();
		await waitFor(() => {
			expect(commands.updateWorktreeExpandedState).toHaveBeenCalledWith(
				'repo-id',
				'test-wt-id',
				true
			);
		});
		expect(invalidate).not.toHaveBeenCalled();
	});

	it('does not leave the project row focused after a mouse click', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',

					worktrees: [
						{
							id: 'test-wt-id',
							branch: 'main',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: []
						}
					]
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));

		expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Expand acme/repo');
	});

	it('keeps project and worktree chevrons hidden until hover/focus styling reveals them', () => {
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',

					worktrees: [
						{
							id: 'main-wt',
							branch: 'main',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: []
						},
						{
							id: 'test-wt-id',
							branch: 'feature',
							isLinkedWorktree: true,
							expandedState: false,
							sessions: []
						}
					]
				}
			]
		});

		const chevrons = Array.from(document.querySelectorAll('svg')).filter((icon) =>
			icon.getAttribute('class')?.includes('opacity-0')
		);

		expect(chevrons.length).toBeGreaterThan(0);
	});

	it('shows session rows with two-line titles and smaller styling', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',

					worktrees: [
						{
							id: 'test-wt-id',
							branch: 'main',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: [
								{
									id: 'session-1',
									title: 'A very long session title that should wrap to a second line',
									status: 'active',
									createdAt: '2026-04-09T10:00:00.000Z',
									updatedAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
						}
					]
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));

		expect(
			await screen.findByRole('link', { name: /a very long session title/i })
		).toBeInTheDocument();
	});

	it('worktree actions show on hover', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',

					worktrees: [
						{
							id: 'test-wt-id',
							branch: 'main',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: [
								{
									id: 'session-1',
									title: 'Active Session',
									status: 'active',
									createdAt: '2026-04-09T10:00:00.000Z',
									updatedAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
						}
					]
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));
		expect(await screen.findByText(/main/)).toBeInTheDocument();
	});

	it('shows project actions in a MoreHorizontal dropdown', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',
					worktrees: [
						{
							id: 'test-wt-id',
							branch: 'develop',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: []
						}
					]
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));
		await user.click(screen.getByRole('button', { name: 'Project actions' }));

		expect(await screen.findByText('Create permanent worktree')).toBeVisible();
		expect(screen.getByText('Remove Project From workspace')).toBeVisible();

		const firstProjectMenuItem = document.querySelector('[data-slot="dropdown-menu-item"]');
		expect(firstProjectMenuItem?.className).toContain('text-[11px]');
		expect(document.querySelector('[data-slot="dropdown-menu-content"]')?.className).toContain(
			'w-48'
		);
		expect(document.querySelector('.project-main')?.className).toContain(
			'group-has-[.project-actions_[data-state=open]]/menu-item:text-sidebar-accent-foreground'
		);
	});

	it('renders default branch as a sub-heading inside expanded content above sessions', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',
					worktrees: [
						{
							id: 'main-wt',
							branch: 'develop',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: [
								{
									id: 'session-1',
									title: 'Default branch session',
									status: 'active',
									createdAt: '2026-04-09T10:00:00.000Z',
									updatedAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
						},
						{
							id: 'wt-feature',
							branch: 'feature/auth',
							isLinkedWorktree: true,
							expandedState: false,
							sessions: []
						}
					]
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));

		await waitFor(() => {
			expect(document.querySelector('.project-default-branch')).not.toBeNull();
		});

		const projectMain = document.querySelector('.project-main');
		expect(projectMain?.textContent).not.toContain('develop');

		const branchBadge = document.querySelector('.project-default-branch');
		expect(branchBadge?.textContent).toContain(':develop');
		expect(branchBadge?.className).toContain('text-[11px]');
		expect(branchBadge?.className).toContain('text-sidebar-foreground/90');
		expect(branchBadge?.className).toContain('mb-1');
		expect(branchBadge?.querySelector('svg')).toBeNull();

		expect(
			await screen.findByRole('link', { name: /default branch session/i })
		).toBeInTheDocument();
		expect(screen.getByText('feature/auth')).toBeInTheDocument();

		const contentText = document.body.textContent ?? '';
		const branchPos = contentText.indexOf(':develop');
		const sessionPos = contentText.indexOf('Default branch session');
		const worktreePos = contentText.indexOf('feature/auth');
		expect(branchPos).toBeLessThan(sessionPos);
		expect(sessionPos).toBeLessThan(worktreePos);
	});

	it('keeps row hover styling independent from project and worktree action zones', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',

					worktrees: [
						{
							id: 'main-wt',
							branch: 'main',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: []
						},
						{
							id: 'test-wt-id',
							branch: 'feature',
							isLinkedWorktree: true,
							expandedState: false,
							sessions: []
						}
					]
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));

		await waitFor(() => {
			expect(document.querySelector('.worktree-main')).not.toBeNull();
		});

		const projectMain = document.querySelector('.project-main');
		const projectActions = document.querySelector('.project-actions');
		const projectButton = document.querySelector('[aria-label="Expand acme/repo"]');
		const worktreeMain = document.querySelector('.worktree-main');
		const worktreeActions = document.querySelector('.worktree-actions');
		const worktreeButton = document.querySelector('[aria-label="Expand feature branch"]');
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
		expect(projectMain?.className).toContain(
			'group-has-[.project-actions_[data-state=open]]/menu-item:text-sidebar-accent-foreground'
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

	it('project rows and worktree rows are not link-styled', () => {
		render(AppSidebarTestWrapper, { projects: [] });
		const sessionLinks = document.querySelectorAll('a');
		expect(sessionLinks.length).toBe(1);
		expect(sessionLinks[0]?.getAttribute('href')).toBe('/');
	});

	it('shows the hide-sidebar tooltip with the shared tooltip styling', async () => {
		render(AppSidebarTestWrapper, { projects: [] });

		const trigger = document.querySelector('[data-slot="tooltip-trigger"]') as HTMLElement | null;
		expect(trigger).not.toBeNull();

		// bits-ui tooltips listen for pointer enter; happy-dom needs explicit pointer events.
		fireEvent.pointerMove(trigger!, { clientX: 1, clientY: 1 });
		fireEvent.pointerEnter(trigger!);
		fireEvent.mouseEnter(trigger!);

		await waitFor(
			() => {
				expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeNull();
			},
			{ timeout: 1000 }
		);

		const tooltip = document.querySelector('[data-slot="tooltip-content"]');
		expect(tooltip).not.toBeNull();
		expect(tooltip?.className).toContain('px-3');
		expect(tooltip?.className).toContain('py-1.5');
		expect(tooltip?.className).toContain('bg-foreground');
		expect(tooltip?.className).toContain('text-background');
	});

	it('delays the hide-sidebar tooltip so it does not appear immediately on hover', async () => {
		render(AppSidebarTestWrapper, { projects: [] });

		const trigger = document.querySelector('[data-slot="tooltip-trigger"]') as HTMLElement | null;
		expect(trigger).not.toBeNull();

		fireEvent.pointerMove(trigger!, { clientX: 1, clientY: 1 });
		fireEvent.pointerEnter(trigger!);
		fireEvent.mouseEnter(trigger!);
		expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();

		await waitFor(
			() => {
				expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeNull();
			},
			{ timeout: 1000 }
		);
		expect(screen.getByText('Hide sidebar')).toBeVisible();
	});

	it('has sidebar session rows in the tree', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',

					worktrees: [
						{
							id: 'test-wt-id',
							branch: 'main',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: [
								{
									id: 's1',
									title: 'Test Session',
									status: 'active',
									createdAt: '2026-04-09T10:00:00.000Z',
									updatedAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
						}
					]
				}
			]
		});
		await user.click(screen.getByRole('button', { name: /repo/i }));
		expect(await screen.findByText('Test Session')).toBeInTheDocument();
	});

	it('marks the flat session route as active', async () => {
		const user = userEvent.setup();
		setPathname('/sessions/session-1');

		const { container } = render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',

					worktrees: [
						{
							id: 'test-wt-id',
							branch: 'main',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: [
								{
									id: 'session-1',
									title: 'Active Session',
									status: 'active',
									createdAt: '2026-04-09T10:00:00.000Z',
									updatedAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
						}
					]
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));

		// Session links include the project id as a query param so the session
		// page knows which project context to load. Match the real href shape.
		await waitFor(() => {
			expect(
				container.querySelector('a[href="/sessions/session-1?project=repo-id"]')
			).toBeInTheDocument();
		});
		const sessionLink = container.querySelector('a[href="/sessions/session-1?project=repo-id"]');
		expect(sessionLink?.closest('[data-active="true"]')).toBeInTheDocument();
	});

	it('remove project invokes close without a confirmation dialog', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',
					worktrees: []
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));
		await user.click(screen.getByRole('button', { name: 'Project actions' }));

		await user.click(await screen.findByText('Remove Project From workspace'));

		expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();

		await waitFor(() => {
			expect(closeProjectMock).toHaveBeenCalledTimes(1);
		});
		expect(closeProjectMock).toHaveBeenCalledWith('repo-id');
	});

	it('create worktree opens branch name dialog without native form', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',
					worktrees: []
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));
		await user.click(screen.getByRole('button', { name: 'Project actions' }));

		await user.click(await screen.findByText('Create permanent worktree'));

		expect(await screen.findByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText('Create Worktree')).toBeVisible();

		const branchInput = document.querySelector(
			'input[name="branchName"]'
		) as HTMLInputElement | null;
		expect(branchInput).toBeInTheDocument();
		expect(branchInput?.value).toBe('');

		expect(document.querySelector('form[action="/?/createWorktree"]')).toBeNull();
	});

	it('delete worktree opens confirmation dialog', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',
					worktrees: [
						{
							id: 'main-wt',
							branch: 'main',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: []
						},
						{
							id: 'wt-feature',
							branch: 'feature/auth',
							isLinkedWorktree: true,
							expandedState: false,
							sessions: []
						}
					]
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));
		expect(await screen.findByText('feature/auth')).toBeInTheDocument();

		(
			document.querySelector('[aria-label="Expand feature/auth branch"]') as HTMLElement | null
		)?.click();

		await user.click(screen.getByRole('button', { name: 'Worktree actions' }));

		await user.click(await screen.findByText('Delete'));

		expect(await screen.findByRole('dialog')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
		expect(screen.getByRole('button', { name: /delete/i })).toBeVisible();

		expect(document.querySelector('form[action="/?/deleteWorktree"]')).toBeNull();
	});

	it('rename worktree opens dialog with empty branch input', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',
					worktrees: [
						{
							id: 'main-wt',
							branch: 'main',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: []
						},
						{
							id: 'wt-feature',
							branch: 'feature/auth',
							isLinkedWorktree: true,
							expandedState: false,
							sessions: []
						}
					]
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));

		(
			document.querySelector('[aria-label="Expand feature/auth branch"]') as HTMLElement | null
		)?.click();

		await user.click(screen.getByRole('button', { name: 'Worktree actions' }));
		await user.click(await screen.findByText('Rename branch'));

		expect(await screen.findByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText('Rename Branch')).toBeVisible();

		const nameInput = document.querySelector('input[name="branchName"]') as HTMLInputElement | null;
		expect(nameInput).toBeInTheDocument();
		expect(nameInput?.value).toBe('');
	});

	it('does not mark nested paths under a session route as active', async () => {
		const user = userEvent.setup();
		setPathname('/sessions/session-1/thread');

		const { container } = render(AppSidebarTestWrapper, {
			projects: [
				{
					displayName: 'acme/repo',
					owner: 'acme',
					path: '/repo',
					id: 'repo-id',
					createdAt: '2026-04-09T10:00:00.000Z',

					worktrees: [
						{
							id: 'test-wt-id',
							branch: 'main',
							isLinkedWorktree: false,
							expandedState: false,
							sessions: [
								{
									id: 'session-1',
									title: 'Active Session',
									status: 'active',
									createdAt: '2026-04-09T10:00:00.000Z',
									updatedAt: '2026-04-09T10:00:00.000Z',
									lastActiveAt: '2026-04-09T10:00:00.000Z'
								}
							]
						}
					]
				}
			]
		});

		await user.click(screen.getByRole('button', { name: /repo/i }));

		// Session links include the project id as a query param (see getSessionHref).
		await waitFor(() => {
			expect(
				container.querySelector('a[href="/sessions/session-1?project=repo-id"]')
			).toBeInTheDocument();
		});
		const sessionLink = container.querySelector('a[href="/sessions/session-1?project=repo-id"]');
		expect(sessionLink?.closest('[data-active="true"]')).toBeNull();
	});
});
