import type { PageLoad } from './$types';
import { sessionsForWorktree } from '$lib/project-tree';

export const ssr = false;

type WorktreeOption = {
	id: string;
	branch: string | null;
};

export const load: PageLoad = async ({ url, parent }) => {
	const { projectTree } = await parent();

	const selectedProjectId = url.searchParams.get('project');
	const selectedWorktreeIdParam = url.searchParams.get('worktreeId');

	const selectedProject = projectTree.find((p) => p.projectId === selectedProjectId) ?? null;

	const worktrees: WorktreeOption[] = selectedProject
		? selectedProject.worktrees.map((worktree) => ({
				id: worktree.id,
				branch: worktree.branch
			}))
		: [];

	const selectedWorktree =
		(selectedWorktreeIdParam ? worktrees.find((wt) => wt.id === selectedWorktreeIdParam) : null) ??
		worktrees[0] ??
		null;

	const firstSessionUnderWorktree = selectedProject
		? sessionsForWorktree(selectedProject, selectedWorktree?.id ?? null).length === 0
		: true;

	return {
		selectedProjectId: selectedProject?.projectId ?? null,
		selectedProjectName: selectedProject?.displayName ?? null,
		selectedWorktreeLabel: selectedWorktree?.branch ?? null,
		selectedWorktreeId: selectedWorktree?.id ?? null,
		firstSessionUnderWorktree,
		worktrees,
		projectTree
	};
};
