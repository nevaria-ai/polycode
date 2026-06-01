import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async ({ url, parent }) => {
	const { projectTree, projects } = await parent();

	const selectedProjectId = url.searchParams.get('project');
	const selectedWorktreePath = url.searchParams.get('worktree');

	const selectedProject = projectTree.find((p) => p.projectId === selectedProjectId) ?? null;

	const allWorktreesForProject = selectedProject
		? [
				...(selectedProject.defaultBranchLabel
					? [{ path: selectedProject.path, branch: selectedProject.defaultBranchLabel }]
					: []),
				...selectedProject.worktrees.map((w) => ({ path: w.path, branch: w.branch }))
			]
		: [];

	const worktrees =
		allWorktreesForProject.length > 0
			? allWorktreesForProject
			: [{ path: selectedProject?.path ?? '', branch: null }];

	const selectedWorktree =
		(selectedWorktreePath ? worktrees.find((wt) => wt.path === selectedWorktreePath) : null) ??
		worktrees[0] ??
		null;

	return {
		selectedProjectId: selectedProject?.projectId ?? null,
		selectedProjectName: selectedProject?.displayName ?? null,
		selectedWorktreePath: selectedWorktree?.path ?? null,
		selectedWorktreeLabel: selectedWorktree?.branch ?? selectedWorktree?.path ?? null,
		selectedWorktreeId: null,
		worktrees,
		projects,
		projectTree
	};
};
