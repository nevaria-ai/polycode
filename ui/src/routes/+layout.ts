import { getProjects, listAllSessions, listWorktrees } from '$lib/services';
import type { Project, Worktree } from '$lib/services';
import { getInitialSidebarStateFromCookieString } from '$components/ui/sidebar';
import type { LayoutLoad } from './$types';

import type { Session } from '$lib/sessions';
import type { WorktreeEntry } from '$lib/sessions';

export const ssr = false;

export const load: LayoutLoad = async () => {
	const [projects, sessions] = await Promise.all([
		getProjects().catch(() => [] as Project[]),
		listAllSessions().catch(() => [] as Session[])
	]);

	const projectTree = await Promise.all(
		projects.map(async (project) => {
			const worktrees = await listWorktrees(project.id).catch(() => [] as Worktree[]);
			const defaultBranch = worktrees.find((w) => w.isPrimary)?.branch ?? null;
			const projectSessions = sessions.filter((s) => s.projectId === project.id);

			return {
				...project,
				path: project.path,
				projectId: project.id,
				displayName: project.name,
				defaultBranchLabel: defaultBranch,
				sessions: projectSessions as Session[],
				worktrees: worktrees
					.filter((w) => !w.isPrimary)
					.map((w) => ({
						...w,
						sessions: sessions.filter((s) => s.worktreeId === w.id) as Session[]
					})) as Array<WorktreeEntry & { sessions: Session[] }>
			};
		})
	);

	return {
		projects,
		initialSidebarOpen: getInitialSidebarStateFromCookieString(
			typeof document !== 'undefined' ? document.cookie : ''
		),
		projectTree
	};
};
