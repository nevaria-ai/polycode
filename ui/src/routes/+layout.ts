import { commands, unwrapCommand } from '$lib/command';
import { getInitialSidebarStateFromCookieString } from '$components/ui/sidebar';
import type { LayoutLoad } from './$types';
import type { SidebarProjectInput } from '$lib/project-tree';

export const ssr = false;

export const load: LayoutLoad = async ({ depends }) => {
	depends('project:tree');
	const projects = await commands
		.listProjects()
		.then(unwrapCommand)
		.catch(() => []);

	const projectTree: SidebarProjectInput[] = projects.map((project) => ({
		path: project.path,
		displayName: project.displayName,
		owner: project.owner,
		projectId: project.id,
		worktrees: project.worktrees.map((worktree) => ({
			id: worktree.id,
			branch: worktree.branch,
			isLinkedWorktree: worktree.isLinkedWorktree,
			expandedState: worktree.expandedState,
			sessions: worktree.sessions
		}))
	}));

	return {
		initialSidebarOpen: getInitialSidebarStateFromCookieString(
			typeof document !== 'undefined' ? document.cookie : ''
		),
		projectTree
	};
};
