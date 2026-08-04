import { commands, unwrapCommand } from '$lib/command';
import { getInitialSidebarStateFromCookieString } from '$components/ui/sidebar';
import type { LayoutLoad } from './$types';
import { worktreeExpanded } from '$lib/worktree-expanded.svelte';

export const ssr = false;

export const load: LayoutLoad = async ({ depends }) => {
	depends('project:tree');
	worktreeExpanded.clear();
	const projects = await commands
		.listProjects()
		.then(unwrapCommand)
		.catch(() => []);

	return {
		initialSidebarOpen: getInitialSidebarStateFromCookieString(
			typeof document !== 'undefined' ? document.cookie : ''
		),
		projects
	};
};
