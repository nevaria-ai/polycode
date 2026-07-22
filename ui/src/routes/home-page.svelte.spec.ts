import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import HomePage from './+page.svelte';
import type { ProjectTree } from '$lib/types/api';

const polycodeProjectId = 'polycode-id';
const docsProjectId = 'docs-id';

const baseProjects: ProjectTree[] = [
	{
		id: polycodeProjectId,
		path: '/Projects/polycode',
		createdAt: '2026-04-09T10:00:00.000Z',
		displayName: 'polycode',
		owner: null,
		worktrees: [
			{
				id: 'main-wt-id',
				branch: 'main',
				isLinkedWorktree: false,
				expandedState: false,
				sessions: []
			},
			{
				id: 'test-wt-id',
				branch: 'feature/auth',
				isLinkedWorktree: true,
				expandedState: false,
				sessions: []
			}
		]
	},
	{
		id: docsProjectId,
		path: '/Projects/docs',
		createdAt: '2026-04-09T10:00:00.000Z',
		displayName: 'docs',
		owner: null,
		worktrees: [
			{
				id: 'docs-main-wt-id',
				branch: 'develop',
				isLinkedWorktree: false,
				expandedState: false,
				sessions: []
			},
			{
				id: 'docs-wt-id',
				branch: 'feature/api',
				isLinkedWorktree: true,
				expandedState: false,
				sessions: []
			}
		]
	}
];

const unlinkedWorktreeId = 'main-wt-id';

const baseData = {
	projectTree: [
		{
			path: baseProjects[0].path,
			projectId: baseProjects[0].id,
			displayName: baseProjects[0].displayName,
			owner: baseProjects[0].owner,
			worktrees: baseProjects[0].worktrees
		},
		{
			path: baseProjects[1].path,
			projectId: baseProjects[1].id,
			displayName: baseProjects[1].displayName,
			owner: baseProjects[1].owner,
			worktrees: baseProjects[1].worktrees
		}
	],
	initialSidebarOpen: true,
	selectedProjectId: polycodeProjectId,
	selectedProjectName: 'polycode',
	selectedWorktreeLabel: 'main',
	selectedWorktreeId: unlinkedWorktreeId,
	firstSessionUnderWorktree: true,
	worktrees: [
		{
			id: unlinkedWorktreeId,
			branch: 'main'
		},
		{
			id: 'test-wt-id',
			branch: 'feature/auth'
		}
	]
};

describe('root homepage', () => {
	it('renders the homepage composer with selected project controls', async () => {
		const { container } = render(HomePage, { data: baseData });
		const headerRow = container.querySelector('[data-testid="homepage-header-row"]');
		const trigger = container.querySelector('[data-slot="dropdown-menu-trigger"]');

		expect(container.textContent).toContain('polycode');
		expect(headerRow?.textContent).not.toContain('Select worktree');
		expect(trigger?.textContent).toContain('polycode');
		expect(trigger?.textContent).toContain(':main');
		expect(container.querySelector('textarea[placeholder="Enter your query!"]')).not.toBeNull();
	});

	it('renders the homepage header row above the shared prompt panel', async () => {
		const { container } = render(HomePage, { data: baseData });

		const promptPanel = container.querySelector('[data-testid="prompt-panel"]');
		const textarea = container.querySelector('textarea[placeholder="Enter your query!"]');
		const headerRow = container.querySelector('[data-testid="homepage-header-row"]');
		const stack = container.querySelector('[data-testid="homepage-composer-stack"]');
		const sessionAsWorktreeCheckbox = container.querySelector(
			'[data-testid="session-as-worktree-checkbox"]'
		);

		expect(promptPanel).not.toBeNull();
		expect(textarea).not.toBeNull();
		expect(headerRow).not.toBeNull();
		expect(sessionAsWorktreeCheckbox).not.toBeNull();
		expect(sessionAsWorktreeCheckbox?.getAttribute('data-state')).toBe('checked');
		expect(sessionAsWorktreeCheckbox?.className).toContain('data-checked:bg-muted');
		expect(sessionAsWorktreeCheckbox?.className).toContain('dark:data-checked:bg-muted');
		expect(stack?.className).toContain('mx-auto');
		expect(stack?.className).toContain('my-auto');
		expect(stack?.className).toContain('flex-col');
		expect(headerRow?.textContent).toContain('polycode');
		expect(headerRow?.textContent).toContain('Session-as-worktree');
		expect(headerRow?.contains(promptPanel)).toBe(false);
		expect(promptPanel?.contains(headerRow)).toBe(false);
	});

	it('renders a combined project and worktree dropdown with grouped project rows and separate branches', async () => {
		render(HomePage, { data: baseData });

		await page.getByRole('button', { name: /select project and worktree/i }).click();

		await expect
			.element(page.getByText('Select project and worktree to start agentic session in'))
			.toBeVisible();
		await expect.element(page.getByText('feature/auth')).toBeVisible();
		await expect.element(page.getByText('docs')).toBeVisible();
		await expect.element(page.getByText('feature/api')).toBeVisible();
		expect(document.querySelectorAll('[data-testid="composer-project-link"]')).toHaveLength(2);
		expect(document.querySelectorAll('[data-testid="composer-worktree-link"]')).toHaveLength(4);

		const projectDefaultBranch = document.querySelector(
			'[data-testid="composer-project-default-branch"]'
		) as HTMLElement | null;
		const projectItem = document.querySelector(
			'[data-testid="composer-project-item"]'
		) as HTMLElement | null;
		const projectLink = document.querySelector(
			'[data-testid="composer-project-link"]'
		) as HTMLElement | null;
		const worktreeLink = document.querySelector(
			'[data-testid="composer-worktree-link"]'
		) as HTMLElement | null;

		expect(projectDefaultBranch?.className).toContain('text-[10px]');
		expect(projectItem?.className).toContain('text-xs');
		expect(projectLink?.getAttribute('data-value')).toBe(
			`/?project=${encodeURIComponent(polycodeProjectId)}`
		);

		const nestedWorktreeItem = document.querySelector(
			'[data-testid="composer-worktree-item"]'
		) as HTMLElement | null;
		expect(nestedWorktreeItem?.className).toContain('text-xs');
		expect(worktreeLink?.getAttribute('data-value')).toBe(
			`/?project=${encodeURIComponent(polycodeProjectId)}&worktreeId=${encodeURIComponent('main-wt-id')}`
		);
	});

	it('renders a project with no linked worktrees as a single clickable project item', async () => {
		const noWorktreeData = {
			...baseData,
			projectTree: baseData.projectTree.map((p) =>
				p.projectId === polycodeProjectId
					? {
							...p,
							worktrees: p.worktrees.filter((worktree) => !worktree.isLinkedWorktree)
						}
					: p
			),
			worktrees: [
				{
					id: unlinkedWorktreeId,
					branch: 'main'
				}
			]
		};
		render(HomePage, { data: noWorktreeData });

		await page.getByRole('button', { name: /select project and worktree/i }).click();

		const projectLink = document.querySelector(
			'[data-testid="composer-project-link"]'
		) as HTMLElement | null;
		expect(document.querySelectorAll('[data-testid="composer-worktree-link"]')).toHaveLength(3);
		expect(projectLink?.getAttribute('data-value')).toBe(
			`/?project=${encodeURIComponent(polycodeProjectId)}`
		);
	});
});
