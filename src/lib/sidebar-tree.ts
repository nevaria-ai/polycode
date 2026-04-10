import type { Session } from '$lib/sessions';
import type { WorktreeEntry } from '$lib/server/git';

export type SidebarTreeWorktree = WorktreeEntry & {
	isExpanded: boolean;
	sessions: Session[];
};

export type SidebarTreeProject = {
	path: string;
	name: string;
	displayName?: string;
	color: string;
	projectId: string;
	isExpanded: boolean;
	worktrees: SidebarTreeWorktree[];
};

export type SidebarTreeProjectInput = Omit<SidebarTreeProject, 'isExpanded' | 'worktrees'> & {
	worktrees: Array<Omit<SidebarTreeWorktree, 'isExpanded'>>;
};

export function materializeSidebarTree(
	projects: SidebarTreeProjectInput[],
	previousTree: SidebarTreeProject[] = []
): SidebarTreeProject[] {
	const previousProjects = new Map(previousTree.map((project) => [project.projectId, project]));

	return projects.map((project) => {
		const previousProject = previousProjects.get(project.projectId);
		const previousWorktrees = new Map(
			(previousProject?.worktrees ?? []).map((worktree) => [worktree.path, worktree])
		);

		return {
			...project,
			isExpanded: previousProject?.isExpanded ?? false,
			worktrees: project.worktrees.map((worktree) => ({
				...worktree,
				isExpanded: previousWorktrees.get(worktree.path)?.isExpanded ?? false
			}))
		};
	});
}
