import type { PageLoad } from './$types';

export const ssr = false;

type WorktreeOption = {
	id: string;
	branch: string | null;
};

export const load: PageLoad = async ({ url, parent }) => {
	const { projectTree, projects } = await parent();

	const selectedProjectId = url.searchParams.get('project');
	const selectedWorktreeIdParam = url.searchParams.get('worktreeId');

	const selectedProject = projectTree.find((p) => p.projectId === selectedProjectId) ?? null;

	const worktrees: WorktreeOption[] = selectedProject
		? [
				...(selectedProject.mainWorktreeId
					? [
							{
								id: selectedProject.mainWorktreeId,
								branch: selectedProject.defaultBranchLabel ?? null
							}
						]
					: []),
				...selectedProject.worktrees.map((w) => ({
					id: w.id,
					branch: w.branch
				}))
			]
		: [];

	const selectedWorktree =
		(selectedWorktreeIdParam ? worktrees.find((wt) => wt.id === selectedWorktreeIdParam) : null) ??
		worktrees[0] ??
		null;

	const firstSessionUnderWorktree = selectedProject
		? countSessionsForWorktree(selectedProject, selectedWorktree?.id ?? null) === 0
		: true;

	return {
		selectedProjectId: selectedProject?.projectId ?? null,
		selectedProjectName: selectedProject?.displayName ?? null,
		selectedWorktreeLabel: selectedWorktree?.branch ?? null,
		selectedWorktreeId: selectedWorktree?.id ?? null,
		firstSessionUnderWorktree,
		worktrees,
		projects,
		projectTree
	};
};

function countSessionsForWorktree(
	project: {
		sessions: Array<{ worktreeId: string | null }>;
		worktrees: Array<{ id: string; sessions: unknown[] }>;
	},
	worktreeId: string | null
): number {
	if (!worktreeId) return 0;
	const nested = project.worktrees.find((worktree) => worktree.id === worktreeId);
	if (nested) return nested.sessions.length;
	return project.sessions.filter((session) => session.worktreeId === worktreeId).length;
}
