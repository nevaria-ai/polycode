import { projectStore, sessionStore } from '$lib/server/stores';

import {
	listGitWorktrees,
	getWorktreeStatus,
	getDefaultBranch,
	isBranchMerged
} from '$lib/server/git';
import { decodeProjectId } from '$lib/projects';
import type { LayoutServerLoad } from './$types';
import type { WorktreeWithSessions, Session } from '$lib/sessions';

export const load: LayoutServerLoad = async ({ params }) => {
	const projectPath = decodeProjectId(params.projectId);
	const projects = await projectStore.list();
	const project = projects.find((p) => p.path === projectPath) ?? null;

	let worktrees: WorktreeWithSessions[] = [];
	if (project) {
		try {
			const gitWorktrees = await listGitWorktrees(project.path);

			// Get default branch for merged checks
			const defaultBranch = await getDefaultBranch(project.path);

			// Load all sessions for this project
			let projectSessions: Session[] = [];
			try {
				const allSessions = await sessionStore.list();
				projectSessions = allSessions.filter(
					(s) => s.projectId === params.projectId && s.status === 'active'
				);
			} catch {
				// Continue without sessions
			}

			// Enrich worktrees with status, merged state, and nested sessions
			worktrees = await Promise.all(
				gitWorktrees.map(async (worktree) => ({
					...worktree,
					status: await getWorktreeStatus(worktree.path),
					isMerged: await isBranchMerged(worktree.path, worktree.branch, defaultBranch),
					sessions: projectSessions
						.filter((s) => s.worktreePath === worktree.path)
						.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
				}))
			);
		} catch {
			worktrees = [];
		}
	}

	return {
		project,
		worktrees
	};
};
