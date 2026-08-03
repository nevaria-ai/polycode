import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import HomePage from './+page.svelte';
import type { ProjectTree } from '$lib/command';
import type { SidebarProjectInput } from '$lib/project-tree';

const eskCodeProjectId = 'esk-code-id';
const docsProjectId = 'docs-id';

const baseProjects: ProjectTree[] = [
	{
		id: eskCodeProjectId,
		path: '/Projects/esk-code',
		createdAt: '2026-04-09T10:00:00.000Z',
		displayName: 'esk-code',
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

function toSidebarProject(project: ProjectTree): SidebarProjectInput {
	return {
		path: project.path,
		projectId: project.id,
		displayName: project.displayName,
		owner: project.owner,
		worktrees: project.worktrees
	};
}

const baseData = {
	projectTree: baseProjects.map(toSidebarProject),
	initialSidebarOpen: true,
	selectedProjectId: eskCodeProjectId,
	selectedProjectName: 'esk-code',
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
	it('renders composer header, prompt panel, and checked session-as-worktree', () => {
		render(HomePage, { data: baseData });

		const headerRow = screen.getByTestId('homepage-header-row');
		const promptPanel = screen.getByTestId('prompt-panel');
		const trigger = screen.getByRole('button', { name: /select project and worktree/i });
		const sessionAsWorktreeCheckbox = screen.getByTestId('session-as-worktree-checkbox');

		expect(trigger).toHaveTextContent('esk-code');
		expect(trigger).toHaveTextContent(':main');
		expect(headerRow).toHaveTextContent('Session-as-worktree');
		expect(headerRow).not.toHaveTextContent('Select worktree');
		expect(headerRow.contains(promptPanel)).toBe(false);
		expect(promptPanel.contains(headerRow)).toBe(false);
		expect(screen.getByPlaceholderText('Enter your query!')).toBeInTheDocument();
		expect(sessionAsWorktreeCheckbox).toHaveAttribute('data-state', 'checked');
	});

	it('renders a combined project and worktree dropdown with grouped project rows and separate branches', async () => {
		const user = userEvent.setup();
		render(HomePage, { data: baseData });

		await user.click(screen.getByRole('button', { name: /select project and worktree/i }));

		expect(
			await screen.findByText('Select project and worktree to start agentic session in')
		).toBeVisible();
		expect(screen.getByText('feature/auth')).toBeVisible();
		expect(screen.getByText('docs')).toBeVisible();
		expect(screen.getByText('feature/api')).toBeVisible();
		expect(screen.getAllByTestId('composer-project-link')).toHaveLength(2);
		expect(screen.getAllByTestId('composer-worktree-link')).toHaveLength(4);

		expect(screen.getAllByTestId('composer-project-link')[0]).toHaveAttribute(
			'data-value',
			`/?project=${encodeURIComponent(eskCodeProjectId)}`
		);
		expect(screen.getAllByTestId('composer-worktree-link')[0]).toHaveAttribute(
			'data-value',
			`/?project=${encodeURIComponent(eskCodeProjectId)}&worktreeId=${encodeURIComponent('main-wt-id')}`
		);
	});

	it('renders a project with no linked worktrees as a single clickable project item', async () => {
		const user = userEvent.setup();
		const noWorktreeData = {
			...baseData,
			projectTree: baseData.projectTree.map((p) =>
				p.projectId === eskCodeProjectId
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

		await user.click(screen.getByRole('button', { name: /select project and worktree/i }));

		await screen.findByText('Select project and worktree to start agentic session in');

		expect(screen.getAllByTestId('composer-worktree-link')).toHaveLength(3);
		expect(screen.getAllByTestId('composer-project-link')[0]).toHaveAttribute(
			'data-value',
			`/?project=${encodeURIComponent(eskCodeProjectId)}`
		);
	});
});
