import { describe, expect, it, beforeEach, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render, cleanup } from 'vitest-browser-svelte';

const { appPage, setPathname, closeProjectMock } = vi.hoisted(() => {
	const state = { url: { pathname: '/' } };

	return {
		appPage: state,
		setPathname: (pathname: string) => {
			state.url.pathname = pathname;
		},
		closeProjectMock: vi.fn(async () => undefined)
	};
});

vi.mock('$app/state', () => ({
	page: appPage
}));

vi.mock('$lib/services', () => ({
	getProjects: vi.fn(async () => []),
	createProject: vi.fn(async () => ({ project: { id: 'test' } })),
	closeProject: closeProjectMock,
	updateProjectExpandedState: vi.fn(async () => ({})),
	listAllSessions: vi.fn(async () => []),
	listSessions: vi.fn(async () => []),
	createSession: vi.fn(async () => ({ session: {} })),
	getSession: vi.fn(async () => ({})),
	deleteSession: vi.fn(async () => undefined),
	updateSessionTitle: vi.fn(async () => ({ session: {} })),
	archiveSession: vi.fn(async () => ({ session: {} })),
	listWorktrees: vi.fn(async () => []),
	createWorktree: vi.fn(async () => ({ worktree: {} })),
	renameWorktree: vi.fn(async () => undefined),
	deleteWorktree: vi.fn(async () => undefined),
	listMessages: vi.fn(async () => []),
	sendMessage: vi.fn(async () => undefined),
	getDirectories: vi.fn(async () => ({ suggestions: [], exists: false }))
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async () => {}),
	invalidateAll: vi.fn(async () => {}),
	replaceState: vi.fn()
}));

import AppSidebarTestWrapper from './AppSidebarTestWrapper.svelte';

describe('AppSidebar', () => {
	beforeEach(() => {
		localStorage.clear();
		cleanup();
		setPathname('/');
		vi.clearAllMocks();
	});

	it('renders in the root layout with no legacy project rail', async () => {
		render(AppSidebarTestWrapper, { projectTree: [] });
		await expect.element(page.getByText('New Session')).toBeInTheDocument();
		await expect.element(page.getByText('Open Project')).toBeInTheDocument();
		await expect.element(page.getByText('Settings')).toBeInTheDocument();
	});

	it('marks New Session as active on the home route', async () => {
		setPathname('/');

		const { container } = render(AppSidebarTestWrapper, { projectTree: [] });

		const newSessionButton = container.querySelector('[data-sidebar="menu-button"]');
		expect(newSessionButton).toBeInTheDocument();
		expect(newSessionButton?.getAttribute('data-active')).toBe('true');
		expect(newSessionButton?.className).toContain('data-active:bg-sidebar-active');
		expect(newSessionButton?.className).toContain('data-active:text-sidebar-active-foreground');
	});

	it('places Open Project in the scrollable tree region header', async () => {
		render(AppSidebarTestWrapper, { projectTree: [] });
		const groups = document.querySelectorAll('[data-sidebar="group"]');
		expect(groups).toHaveLength(2);
		expect(groups[1]?.textContent).toContain('Open Project');
	});

	it('toggles project expansion on row click', async () => {
		const projectTree = [
			{
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				expandedState: false,
				worktrees: [
					{ id: 'test-wt-id', name: 'test-wt-name', path: '/repo', branch: 'main', sessions: [] }
				]
			}
		];

		render(AppSidebarTestWrapper, { projectTree });

		await expect.element(page.getByText('acme/repo')).toBeInTheDocument();

		const projectRow = page.getByRole('button', { name: /repo/i });
		await projectRow.click();

		await expect.element(page.getByText('main')).toBeInTheDocument();
	});

	it('does not leave the project row focused after a mouse click', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,

					worktrees: [
						{ id: 'test-wt-id', name: 'test-wt-name', path: '/repo', branch: 'main', sessions: [] }
					]
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();

		expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Expand repo');
	});

	it('keeps project and worktree chevrons hidden until hover/focus styling reveals them', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					displayName: 'acme/repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,

					worktrees: [
						{ id: 'test-wt-id', name: 'test-wt-name', path: '/repo', branch: 'main', sessions: [] }
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
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,

					worktrees: [
						{
							id: 'test-wt-id',
							name: 'test-wt-name',
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 'session-1',
									worktreeId: 'wt-1',
									title: 'A very long session title that should wrap to a second line',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',

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
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,

					worktrees: [
						{
							id: 'test-wt-id',
							name: 'test-wt-name',
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 'session-1',
									worktreeId: 'wt-1',
									title: 'Active Session',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',

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
		await expect.element(page.getByText('main')).toBeInTheDocument();
	});

	it('shows project actions in a MoreHorizontal dropdown', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,
					sessions: [],
					defaultBranchLabel: 'develop',
					worktrees: [
						{ id: 'test-wt-id', name: 'test-wt-name', path: '/repo', branch: 'main', sessions: [] }
					]
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();
		await page.getByRole('button', { name: 'Project actions' }).click();

		await expect.element(page.getByText('Create permanent worktree')).toBeVisible();
		await expect.element(page.getByText('Remove Project From workspace')).toBeVisible();

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
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					displayName: 'acme/repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,

					defaultBranchLabel: 'develop',
					sessions: [
						{
							id: 'session-1',
							worktreeId: 'wt-1',
							title: 'Default branch session',
							projectId: 'repo-id',
							worktreePath: '/repo',
							status: 'active',

							createdAt: '2026-04-09T10:00:00.000Z',
							lastActiveAt: '2026-04-09T10:00:00.000Z'
						}
					],
					worktrees: [
						{
							id: 'test-wt-id',
							name: 'test-wt-name',
							path: '/repo-feature',
							branch: 'feature/auth',
							sessions: []
						}
					]
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();

		const projectMain = document.querySelector('.project-main');
		expect(projectMain?.textContent).not.toContain('develop');

		const branchBadge = document.querySelector('.project-default-branch');
		expect(branchBadge?.textContent).toContain(':develop');
		expect(branchBadge?.className).toContain('text-[11px]');
		expect(branchBadge?.className).toContain('text-sidebar-foreground/90');
		expect(branchBadge?.className).toContain('mb-1');
		expect(branchBadge?.querySelector('svg')).toBeNull();

		await expect
			.element(page.getByRole('link', { name: /default branch session/i }))
			.toBeInTheDocument();
		await expect.element(page.getByText('feature/auth')).toBeInTheDocument();

		const contentText = document.body.textContent ?? '';
		const branchPos = contentText.indexOf(':develop');
		const sessionPos = contentText.indexOf('Default branch session');
		const worktreePos = contentText.indexOf('feature/auth');
		expect(branchPos).toBeLessThan(sessionPos);
		expect(sessionPos).toBeLessThan(worktreePos);
	});

	it('keeps row hover styling independent from project and worktree action zones', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,

					worktrees: [
						{
							id: 'test-wt-id',
							name: 'test-wt-name',
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

	it('project rows and worktree rows are not link-styled', async () => {
		render(AppSidebarTestWrapper, { projectTree: [] });
		const sessionLinks = document.querySelectorAll('a');
		expect(sessionLinks.length).toBe(1);
		expect(sessionLinks[0]?.getAttribute('href')).toBe('/');
	});

	it('shows the hide-sidebar tooltip with the shared tooltip styling', async () => {
		render(AppSidebarTestWrapper, { projectTree: [] });

		await page.getByRole('button', { name: 'Hide sidebar' }).nth(1).hover();
		await expect.element(page.getByText('Hide sidebar')).toBeVisible();

		const tooltip = document.querySelector('[data-slot="tooltip-content"]');
		expect(tooltip).not.toBeNull();
		expect(tooltip?.className).toContain('px-3');
		expect(tooltip?.className).toContain('py-1.5');
		expect(tooltip?.className).toContain('bg-foreground');
		expect(tooltip?.className).toContain('text-background');
	});

	it('delays the hide-sidebar tooltip so it does not appear immediately on hover', async () => {
		render(AppSidebarTestWrapper, { projectTree: [] });

		await page.getByRole('button', { name: 'Hide sidebar' }).nth(1).hover();
		expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();

		await new Promise((resolve) => setTimeout(resolve, 450));
		await expect.element(page.getByText('Hide sidebar')).toBeVisible();
	});

	it('has sidebar session rows in the tree', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,

					worktrees: [
						{
							id: 'test-wt-id',
							name: 'test-wt-name',
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 's1',
									worktreeId: 'wt-1',
									title: 'Test Session',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',

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
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,

					worktrees: [
						{
							id: 'test-wt-id',
							name: 'test-wt-name',
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 'session-1',
									worktreeId: 'wt-1',
									title: 'Active Session',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',

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

		// Session links include the project id as a query param so the session
		// page knows which project context to load. Match the real href shape.
		const sessionLink = container.querySelector('a[href="/sessions/session-1?project=repo-id"]');
		expect(sessionLink).toBeInTheDocument();
		expect(sessionLink?.closest('[data-active="true"]')).toBeInTheDocument();
	});

	it('remove project fires fetch without a confirmation dialog', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,
					sessions: [],
					defaultBranchLabel: 'develop',
					worktrees: []
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();
		await page.getByRole('button', { name: 'Project actions' }).click();

		await page.getByText('Remove Project From workspace').click();

		expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();

		expect(closeProjectMock).toHaveBeenCalledTimes(1);
		expect(closeProjectMock).toHaveBeenCalledWith('repo-id');
	});

	it('create worktree opens branch name dialog without native form', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,
					sessions: [],
					defaultBranchLabel: 'develop',
					worktrees: []
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();
		await page.getByRole('button', { name: 'Project actions' }).click();

		await page.getByText('Create permanent worktree').click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Create Worktree')).toBeVisible();

		const branchInput = document.querySelector(
			'input[name="branchName"]'
		) as HTMLInputElement | null;
		expect(branchInput).toBeInTheDocument();
		expect(branchInput?.value).toBe('');

		expect(document.querySelector('form[action="/?/createWorktree"]')).toBeNull();
	});

	it('delete worktree opens confirmation dialog', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,
					sessions: [],
					worktrees: [
						{
							id: 'test-wt-id',
							name: 'test-wt-name',
							path: '/repo-feature',
							branch: 'feature/auth',
							sessions: []
						}
					]
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();
		await expect.element(page.getByText('feature/auth')).toBeInTheDocument();

		(
			document.querySelector('[aria-label="Expand feature/auth branch"]') as HTMLElement | null
		)?.click();

		await page.getByRole('button', { name: 'Worktree actions' }).click();

		await page.getByText('Delete').click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /cancel/i })).toBeVisible();
		await expect.element(page.getByRole('button', { name: /delete/i })).toBeVisible();

		expect(document.querySelector('form[action="/?/deleteWorktree"]')).toBeNull();
	});

	it('rename worktree reuses worktree dialog with prefilled input', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,
					sessions: [],
					worktrees: [
						{
							id: 'test-wt-id',
							name: 'test-wt-name',
							path: '/repo-feature',
							branch: 'feature/auth',
							sessions: []
						}
					]
				}
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();

		(
			document.querySelector('[aria-label="Expand feature/auth branch"]') as HTMLElement | null
		)?.click();

		await page.getByRole('button', { name: 'Worktree actions' }).click();
		await page.getByText('Rename').click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Rename Branch')).toBeVisible();

		const nameInput = document.querySelector('input[name="branchName"]') as HTMLInputElement | null;
		expect(nameInput).toBeInTheDocument();
		expect(nameInput?.value).toBe('feature/auth');
	});

	it('does not mark nested paths under a session route as active', async () => {
		setPathname('/sessions/session-1/thread');

		const { container } = render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					path: '/repo',
					projectId: 'repo-id',
					expandedState: false,

					worktrees: [
						{
							id: 'test-wt-id',
							name: 'test-wt-name',
							path: '/repo',
							branch: 'main',
							sessions: [
								{
									id: 'session-1',
									worktreeId: 'wt-1',
									title: 'Active Session',
									projectId: 'repo-id',
									worktreePath: '/repo',
									status: 'active',

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

		// Session links include the project id as a query param (see sessionHref).
		const sessionLink = container.querySelector('a[href="/sessions/session-1?project=repo-id"]');
		expect(sessionLink).toBeInTheDocument();
		expect(sessionLink?.closest('[data-active="true"]')).toBeNull();
	});
});
