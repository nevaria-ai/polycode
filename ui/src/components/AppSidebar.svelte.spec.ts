import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { SidebarProjectInput } from '$lib/project-tree';
import type { SessionSummaryDto, WorktreeDto } from '$lib/command';

const { appPage, setPathname, closeProjectMock, updateWorktreeExpandedStateMock, invalidateMock } =
	vi.hoisted(() => {
		const state = { url: { pathname: '/' } };

		return {
			appPage: state,
			setPathname: (pathname: string) => {
				state.url.pathname = pathname;
			},
			closeProjectMock: vi.fn(async () => ({ status: 'ok' as const, data: null })),
			updateWorktreeExpandedStateMock: vi.fn(async () => ({ status: 'ok' as const, data: null })),
			invalidateMock: vi.fn(async () => {})
		};
	});

vi.mock('$app/state', () => ({
	page: appPage
}));

vi.mock('$lib/bindings', () => ({
	commands: {
		closeProject: closeProjectMock,
		updateWorktreeExpandedState: updateWorktreeExpandedStateMock
	}
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async () => {}),
	invalidate: invalidateMock,
	replaceState: vi.fn()
}));

import AppSidebarTestWrapper from './AppSidebarTestWrapper.svelte';

const SESSION_STAMP = {
	createdAt: '2026-04-09T10:00:00.000Z',
	updatedAt: '2026-04-09T10:00:00.000Z',
	lastActiveAt: '2026-04-09T10:00:00.000Z'
} as const;

function session(
	partial: Pick<SessionSummaryDto, 'id' | 'title'> & Partial<SessionSummaryDto>
): SessionSummaryDto {
	return {
		status: 'active',
		...SESSION_STAMP,
		...partial
	};
}

function worktree(
	partial: Pick<WorktreeDto, 'id' | 'branch' | 'isLinkedWorktree'> & Partial<WorktreeDto>
): WorktreeDto {
	return {
		expandedState: false,
		sessions: [],
		...partial
	};
}

function project(
	partial: Partial<SidebarProjectInput> & Pick<SidebarProjectInput, 'worktrees'> = { worktrees: [] }
): SidebarProjectInput {
	return {
		displayName: 'acme/repo',
		owner: 'acme',
		path: '/repo',
		projectId: 'repo-id',
		...partial
	};
}

function baseProject(overrides?: Partial<SidebarProjectInput>): SidebarProjectInput {
	return project({
		worktrees: [worktree({ id: 'test-wt-id', branch: 'main', isLinkedWorktree: false })],
		...overrides
	});
}

async function expandProject(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('button', { name: /repo/i }));
}

async function openHideSidebarTooltip() {
	const trigger = document.querySelector(
		'[data-sidebar="header"] [aria-label="Hide sidebar"]'
	) as HTMLElement | null;
	expect(trigger).not.toBeNull();

	// bits-ui tooltips listen for pointer enter; happy-dom needs explicit pointer events.
	fireEvent.pointerMove(trigger!, { clientX: 1, clientY: 1 });
	fireEvent.pointerEnter(trigger!);
	fireEvent.mouseEnter(trigger!);
}

describe('AppSidebar', () => {
	beforeEach(() => {
		localStorage.clear();
		setPathname('/');
		closeProjectMock.mockReset();
		closeProjectMock.mockResolvedValue({ status: 'ok' as const, data: null });
		updateWorktreeExpandedStateMock.mockReset();
		updateWorktreeExpandedStateMock.mockResolvedValue({ status: 'ok' as const, data: null });
		invalidateMock.mockReset();
		invalidateMock.mockResolvedValue(undefined);
	});

	it('renders in the root layout with no legacy project rail', () => {
		render(AppSidebarTestWrapper, { projectTree: [] });
		expect(screen.getByText('New Session')).toBeInTheDocument();
		expect(screen.getByText('Open Project')).toBeInTheDocument();
		expect(screen.getByText('Settings')).toBeInTheDocument();
	});

	it('marks New Session as active on the home route', () => {
		setPathname('/');

		const { container } = render(AppSidebarTestWrapper, { projectTree: [] });

		const newSessionButton = container.querySelector('[data-sidebar="menu-button"]');
		expect(newSessionButton).toBeInTheDocument();
		expect(newSessionButton?.getAttribute('data-active')).toBe('true');
	});

	it('places Open Project in the scrollable tree region header', () => {
		render(AppSidebarTestWrapper, { projectTree: [] });
		const groups = document.querySelectorAll('[data-sidebar="group"]');
		expect(groups).toHaveLength(2);
		expect(groups[1]?.textContent).toContain('Open Project');
	});

	it('toggles expansion via updateWorktreeExpandedState without invalidating project:tree', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, { projectTree: [baseProject()] });

		await expandProject(user);

		await waitFor(() => {
			expect(updateWorktreeExpandedStateMock).toHaveBeenCalledWith('repo-id', 'test-wt-id', true);
		});
		expect(document.querySelector('.project-default-branch')?.textContent).toContain(':main');
		expect(invalidateMock).not.toHaveBeenCalled();
	});

	it('does not leave the project row focused after a mouse click', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, { projectTree: [baseProject()] });

		await expandProject(user);

		expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Expand acme/repo');
	});

	it('keeps project and worktree chevrons hidden until hover/focus styling reveals them', () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				project({
					worktrees: [
						worktree({ id: 'main-wt', branch: 'main', isLinkedWorktree: false }),
						worktree({ id: 'test-wt-id', branch: 'feature', isLinkedWorktree: true })
					]
				})
			]
		});

		const chevrons = Array.from(document.querySelectorAll('svg')).filter((icon) =>
			icon.getAttribute('class')?.includes('opacity-0')
		);

		expect(chevrons.length).toBeGreaterThan(0);
	});

	it('renders session links that allow multi-line titles', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projectTree: [
				baseProject({
					worktrees: [
						worktree({
							id: 'test-wt-id',
							branch: 'main',
							isLinkedWorktree: false,
							sessions: [
								session({
									id: 'session-1',
									title: 'A very long session title that should wrap to a second line'
								})
							]
						})
					]
				})
			]
		});

		await expandProject(user);

		const sessionLink = await screen.findByRole('link', {
			name: /a very long session title/i
		});
		expect(sessionLink).toBeInTheDocument();
		expect(sessionLink.className).toContain('sidebar-session-link');
		expect(sessionLink.className).toContain('h-auto');
		expect(sessionLink.className).toContain('items-start');
	});

	it('shows project actions in a MoreHorizontal dropdown', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projectTree: [
				baseProject({
					worktrees: [worktree({ id: 'test-wt-id', branch: 'develop', isLinkedWorktree: false })]
				})
			]
		});

		await expandProject(user);
		await user.click(screen.getByRole('button', { name: 'Project actions' }));

		expect(await screen.findByText('Create permanent worktree')).toBeVisible();
		expect(screen.getByText('Remove Project From workspace')).toBeVisible();
		expect(document.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeNull();
	});

	it('renders default branch as a sub-heading inside expanded content above sessions', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projectTree: [
				project({
					worktrees: [
						worktree({
							id: 'main-wt',
							branch: 'develop',
							isLinkedWorktree: false,
							sessions: [session({ id: 'session-1', title: 'Default branch session' })]
						}),
						worktree({ id: 'wt-feature', branch: 'feature/auth', isLinkedWorktree: true })
					]
				})
			]
		});

		await expandProject(user);

		const branchBadge = await waitFor(() => {
			const el = document.querySelector('.project-default-branch');
			expect(el).not.toBeNull();
			return el!;
		});

		expect(document.querySelector('.project-main')?.textContent).not.toContain('develop');
		expect(branchBadge.textContent).toContain(':develop');
		expect(branchBadge.querySelector('svg')).toBeNull();

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

	it('keeps row action zones distinct from project and worktree mains', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projectTree: [
				project({
					worktrees: [
						worktree({ id: 'main-wt', branch: 'main', isLinkedWorktree: false }),
						worktree({ id: 'test-wt-id', branch: 'feature', isLinkedWorktree: true })
					]
				})
			]
		});

		await expandProject(user);

		await waitFor(() => {
			expect(document.querySelector('.worktree-main')).not.toBeNull();
		});

		expect(document.querySelector('.project-main')).not.toBeNull();
		expect(document.querySelector('.project-actions')).not.toBeNull();
		expect(document.querySelector('[aria-label="Expand acme/repo"]')).not.toBeNull();
		expect(document.querySelector('.worktree-actions')).not.toBeNull();
		expect(
			document.querySelector('.worktree-actions [data-slot="dropdown-menu-trigger"]')
		).not.toBeNull();
		expect(document.querySelector('[aria-label="Expand feature branch"]')).not.toBeNull();
	});

	it('project rows and worktree rows are not link-styled', () => {
		render(AppSidebarTestWrapper, { projectTree: [] });
		const sessionLinks = document.querySelectorAll('a');
		expect(sessionLinks.length).toBe(1);
		expect(sessionLinks[0]?.getAttribute('href')).toBe('/');
	});

	it('delays the hide-sidebar tooltip before showing Hide sidebar', async () => {
		render(AppSidebarTestWrapper, { projectTree: [] });

		await openHideSidebarTooltip();
		expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();

		await waitFor(
			() => {
				expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeNull();
			},
			{ timeout: 1000 }
		);
		expect(screen.getByText('Hide sidebar')).toBeVisible();
	});

	it('marks the flat session route as active', async () => {
		const user = userEvent.setup();
		setPathname('/sessions/session-1');

		render(AppSidebarTestWrapper, {
			projectTree: [
				baseProject({
					worktrees: [
						worktree({
							id: 'test-wt-id',
							branch: 'main',
							isLinkedWorktree: false,
							sessions: [session({ id: 'session-1', title: 'Active Session' })]
						})
					]
				})
			]
		});

		await expandProject(user);

		const sessionLink = await screen.findByRole('link', { name: /active session/i });
		expect(sessionLink).toHaveAttribute('href', '/sessions/session-1?project=repo-id');
		expect(sessionLink.closest('[data-active="true"]')).toBeInTheDocument();
	});

	it('remove project invokes close without a confirmation dialog', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projectTree: [project({ worktrees: [] })]
		});

		await expandProject(user);
		await user.click(screen.getByRole('button', { name: 'Project actions' }));
		await user.click(await screen.findByText('Remove Project From workspace'));

		expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
		await waitFor(() => {
			expect(closeProjectMock).toHaveBeenCalledTimes(1);
		});
		expect(closeProjectMock).toHaveBeenCalledWith('repo-id');
		expect(invalidateMock).toHaveBeenCalledWith('project:tree');
	});

	it('create worktree opens branch name dialog without native form', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projectTree: [project({ worktrees: [] })]
		});

		await expandProject(user);
		await user.click(screen.getByRole('button', { name: 'Project actions' }));
		await user.click(await screen.findByText('Create permanent worktree'));

		expect(await screen.findByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText('Create Worktree')).toBeVisible();
		expect(screen.getByRole('textbox')).toHaveValue('');
		expect(document.querySelector('form[action="/?/createWorktree"]')).toBeNull();
	});

	it('delete worktree opens confirmation dialog', async () => {
		const user = userEvent.setup();
		render(AppSidebarTestWrapper, {
			projectTree: [
				project({
					worktrees: [
						worktree({ id: 'main-wt', branch: 'main', isLinkedWorktree: false }),
						worktree({ id: 'wt-feature', branch: 'feature/auth', isLinkedWorktree: true })
					]
				})
			]
		});

		await expandProject(user);
		expect(await screen.findByText('feature/auth')).toBeInTheDocument();

		await user.click(screen.getByLabelText('Expand feature/auth branch'));
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
			projectTree: [
				project({
					worktrees: [
						worktree({ id: 'main-wt', branch: 'main', isLinkedWorktree: false }),
						worktree({ id: 'wt-feature', branch: 'feature/auth', isLinkedWorktree: true })
					]
				})
			]
		});

		await expandProject(user);
		await user.click(await screen.findByLabelText('Expand feature/auth branch'));
		await user.click(screen.getByRole('button', { name: 'Worktree actions' }));
		await user.click(await screen.findByText('Rename branch'));

		expect(await screen.findByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText('Rename Branch')).toBeVisible();
		expect(screen.getByRole('textbox')).toHaveValue('');
	});

	it('does not mark nested paths under a session route as active', async () => {
		const user = userEvent.setup();
		setPathname('/sessions/session-1/thread');

		render(AppSidebarTestWrapper, {
			projectTree: [
				baseProject({
					worktrees: [
						worktree({
							id: 'test-wt-id',
							branch: 'main',
							isLinkedWorktree: false,
							sessions: [session({ id: 'session-1', title: 'Active Session' })]
						})
					]
				})
			]
		});

		await expandProject(user);

		const sessionLink = await screen.findByRole('link', { name: /active session/i });
		expect(sessionLink).toHaveAttribute('href', '/sessions/session-1?project=repo-id');
		expect(sessionLink.closest('[data-active="true"]')).toBeNull();
	});
});
