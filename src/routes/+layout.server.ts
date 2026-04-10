import { projectStore, cliProfileStore, sessionStore } from '$lib/server/stores';
import { getRemoteDisplayName, listGitWorktrees } from '$lib/server/git';
import { buildSidebarProjects } from '$lib/server/sidebar';
import { getInitialSidebarStateFromCookieString } from '$components/ui/sidebar';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ request }) => {
	const [projects, cliProfiles, sessions] = await Promise.all([
		projectStore.list(),
		cliProfileStore.list(),
		sessionStore.list()
	]);

	const [worktreesByProject, remoteDisplayNames] = await Promise.all([
		new Map(
			await Promise.all(
				projects.map(
					async (project) => [project.path, await listGitWorktrees(project.path)] as const
				)
			)
		),
		new Map(
			(
				await Promise.all(
					projects.map(async (project) => {
						const displayName = await getRemoteDisplayName(project.path);
						return displayName ? ([project.path, displayName] as const) : null;
					})
				)
			).filter((entry) => entry !== null)
		)
	]);

	return {
		projects,
		cliProfiles,
		initialSidebarOpen: getInitialSidebarStateFromCookieString(request.headers.get('cookie') ?? ''),
		sidebarProjects: buildSidebarProjects(
			projects,
			worktreesByProject,
			sessions.filter((session) => session.status === 'active'),
			remoteDisplayNames
		)
	};
};
