import type { Session, WorktreeEntry } from '$lib/sessions';

export type ProjectTreeWorktree = WorktreeEntry & {
	isExpanded: boolean;
	sessions: Session[];
};

export type ProjectTreeProject = {
	path: string;
	name: string;
	displayName?: string;
	projectId: string;
	defaultBranchLabel?: string | null;
	sessions?: Session[];
	isExpanded: boolean;
	worktrees: ProjectTreeWorktree[];
};

export type ProjectTreeProjectInput = Omit<ProjectTreeProject, 'isExpanded' | 'worktrees'> & {
	expandedState: boolean;
	worktrees: Array<Omit<ProjectTreeWorktree, 'isExpanded'>>;
};

export function materializeProjectTree(
	projects: ProjectTreeProjectInput[],
	previousTree: ProjectTreeProject[] = []
): ProjectTreeProject[] {
	const previousProjects = new Map(previousTree.map((project) => [project.projectId, project]));

	return projects.map((project) => {
		const previousProject = previousProjects.get(project.projectId);
		const previousWorktrees = new Map(
			(previousProject?.worktrees ?? []).map((worktree) => [worktree.path, worktree])
		);

		return {
			...project,
			defaultBranchLabel: project.defaultBranchLabel ?? null,
			sessions: project.sessions ?? [],
			isExpanded: previousProject?.isExpanded ?? project.expandedState,
			worktrees: project.worktrees.map((worktree) => ({
				...worktree,
				isExpanded: previousWorktrees.get(worktree.path)?.isExpanded ?? false
			}))
		};
	});
}
