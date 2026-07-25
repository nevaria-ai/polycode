import type { ApiWorktreeWithSessions } from '$lib/command';

export type ExpandedWorktree = ApiWorktreeWithSessions & {
	isExpanded: boolean;
};

export type SidebarProject = {
	path: string;
	displayName: string;
	owner: string | null;
	projectId: string;
	isExpanded: boolean;
	worktrees: ExpandedWorktree[];
};

export type SidebarProjectInput = Omit<SidebarProject, 'isExpanded' | 'worktrees'> & {
	worktrees: ApiWorktreeWithSessions[];
};

export function unlinkedWorktree<T extends ApiWorktreeWithSessions>(project: { worktrees: T[] }) {
	return project.worktrees.find((worktree) => !worktree.isLinkedWorktree) ?? null;
}

export function linkedWorktrees<T extends ApiWorktreeWithSessions>(project: { worktrees: T[] }) {
	return project.worktrees.filter((worktree) => worktree.isLinkedWorktree);
}

export function sessionsForWorktree(
	project: { worktrees: ApiWorktreeWithSessions[] },
	worktreeId: string | null
): ApiWorktreeWithSessions['sessions'] {
	if (!worktreeId) return [];
	return project.worktrees.find((worktree) => worktree.id === worktreeId)?.sessions ?? [];
}

export function materializeProjectTree(
	projects: SidebarProjectInput[],
	previousTree: SidebarProject[] = []
): SidebarProject[] {
	const previousProjects = new Map(previousTree.map((project) => [project.projectId, project]));

	return projects.map((project) => {
		const previousProject = previousProjects.get(project.projectId);
		const previousWorktrees = new Map(
			(previousProject?.worktrees ?? []).map((worktree) => [worktree.id, worktree])
		);

		const worktrees = project.worktrees.map((worktree) => ({
			...worktree,
			isExpanded: previousWorktrees.get(worktree.id)?.isExpanded ?? worktree.expandedState ?? false
		}));

		const unlinked = worktrees.find((worktree) => !worktree.isLinkedWorktree);

		return {
			...project,
			isExpanded: previousProject?.isExpanded ?? unlinked?.isExpanded ?? false,
			worktrees
		};
	});
}
