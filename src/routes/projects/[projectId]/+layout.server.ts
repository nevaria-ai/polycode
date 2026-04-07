import { createProjectStore } from '$lib/server/projects';
import {
	listGitWorktrees,
	getWorktreeStatus,
	getDefaultBranch,
	isBranchMerged,
	type WorktreeEntry
} from '$lib/server/git';
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

			// Get default branch for merged checks
			const defaultBranch = await getDefaultBranch(project.path);

			// Check status and merged state of each worktree
			worktrees = await Promise.all(
				worktrees.map(async (worktree) => ({
					...worktree,
					status: await getWorktreeStatus(worktree.path),
					isMerged: await isBranchMerged(worktree.path, worktree.branch, defaultBranch)
				}))
			);
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
