import { createProjectStore } from '$lib/server/projects';
import { listGitWorktrees, type WorktreeEntry } from '$lib/server/git';
import { decodeProjectId } from '$lib/projects';
import type { LayoutServerLoad } from './$types';

const projectStore = createProjectStore();

export const load: LayoutServerLoad = async ({ params }) => {
	const projectPath = decodeProjectId(params.projectId);
	const projects = await projectStore.list();
	const project = projects.find((p) => p.path === projectPath) ?? null;

	let worktrees: WorktreeEntry[] = [];
	if (project) {
		try {
			worktrees = await listGitWorktrees(project.path);
		} catch {
			// If git worktrees fail, just return empty array
			worktrees = [];
		}
	}

	return {
		project,
		worktrees
	};
};
