import { commands, unwrapCommand } from '$lib/command';
import { getInitialSidebarStateFromCookieString } from '$components/ui/sidebar';
import type { LayoutLoad } from './$types';
import { worktreeExpanded } from '$lib/worktree-expanded.svelte';

export const ssr = false;

export const load: LayoutLoad = async ({ depends }) => {
	depends('project:tree');
	const projects = await commands
		.listProjects()
		.then(unwrapCommand)
		.catch(() => []);
	// Clear after fetch so overlay still wins while IPC is in flight (avoids collapse flash).
	worktreeExpanded.clear();

	return {
		initialSidebarOpen: getInitialSidebarStateFromCookieString(
			typeof document !== 'undefined' ? document.cookie : ''
		),
		projects
	};
};
