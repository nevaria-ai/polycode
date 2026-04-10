import { encodeProjectId } from '$lib/projects';
import type { Session } from '$lib/sessions';
import type { StoredProject } from '$lib/projects';
import type { WorktreeEntry } from '$lib/server/git';
import type { SidebarTreeProjectInput } from '$lib/sidebar-tree';

export type SidebarProject = SidebarTreeProjectInput;

export function buildSidebarProjects(
	projects: StoredProject[],
	worktreesByProject: Map<string, WorktreeEntry[]>,
	sessions: Session[],
	remoteDisplayNames: Map<string, string> = new Map()
): SidebarProject[] {
	return projects.map((project) => {
		const projectId = encodeProjectId(project.path);
		const worktrees = (worktreesByProject.get(project.path) ?? []).map((worktree) => ({
			...worktree,
			sessions: sessions
				.filter(
					(session) => session.projectId === projectId && session.worktreePath === worktree.path
				)
				.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
		}));

		return {
			...project,
			projectId,
			displayName: remoteDisplayNames.get(project.path) ?? project.name,
			worktrees
		};
	});
}
