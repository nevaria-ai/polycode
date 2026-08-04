import type { PageLoad } from './$types';
import { getSessionsForWorktree } from '$lib/worktree';

export const ssr = false;

type WorktreeOption = {
	id: string;
	branch: string | null;
};

export const load: PageLoad = async ({ url, parent }) => {
	const { projects } = await parent();

	const selectedProjectId = url.searchParams.get('project');
	const selectedWorktreeIdParam = url.searchParams.get('worktreeId');

	const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

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
		? getSessionsForWorktree(selectedProject.worktrees, selectedWorktree?.id ?? null).length === 0
		: true;

	return {
		selectedProjectId: selectedProject?.id ?? null,
		selectedProjectName: selectedProject?.displayName ?? null,
		selectedWorktreeLabel: selectedWorktree?.branch ?? null,
		selectedWorktreeId: selectedWorktree?.id ?? null,
		firstSessionUnderWorktree,
		worktrees,
		projects
	};
};
