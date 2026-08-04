import type { PageLoad } from './$types';

export const ssr = false;

type WorktreeOption = {
	id: string;
	branch: string | null;
};

export const load: PageLoad = async ({ url, parent }) => {
	const { projects } = await parent();

	const selectedWorktreeIdParam = url.searchParams.get('workspace');

	const selectedProject = selectedWorktreeIdParam
		? (projects.find((project) =>
				project.worktrees.some((worktree) => worktree.id === selectedWorktreeIdParam)
			) ?? null)
		: null;

	const worktrees: WorktreeOption[] = selectedProject
		? selectedProject.worktrees.map((worktree) => ({
				id: worktree.id,
				branch: worktree.branch
			}))
		: [];

	const selectedWorktree = selectedWorktreeIdParam
		? (worktrees.find((wt) => wt.id === selectedWorktreeIdParam) ?? null)
		: null;

	return {
		selectedProjectId: selectedProject?.id ?? null,
		selectedProjectName: selectedProject?.displayName ?? null,
		selectedWorktreeId: selectedWorktree?.id ?? null,
		worktrees,
		projects
	};
};
