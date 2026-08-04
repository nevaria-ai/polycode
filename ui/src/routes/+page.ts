import type { PageLoad } from './$types';
import type { ProjectDto, WorktreeDto } from '$lib/command';

export const ssr = false;

export const load: PageLoad = async ({ url, parent }) => {
	const { projects } = await parent();
	const workspaceId = url.searchParams.get('workspace');

	let selectedProject: ProjectDto | null = null;
	let selectedWorktree: WorktreeDto | null = null;

	if (workspaceId) {
		for (const project of projects) {
			const worktree = project.worktrees.find((item) => item.id === workspaceId);
			if (worktree) {
				selectedProject = project;
				selectedWorktree = worktree;
				break;
			}
		}
	}

	return {
		selectedProject,
		selectedWorktree,
		projects
	};
};
