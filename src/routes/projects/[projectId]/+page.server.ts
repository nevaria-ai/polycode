import { projectStore, sessionStore } from '$lib/server/stores';

import { createWorktree, deleteWorktree } from '$lib/server/git';
import { decodeProjectId } from '$lib/projects';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const projectPath = decodeProjectId(params.projectId);
	const project = await projectStore.findByPath(projectPath);

	if (project?.lastSessionId) {
		const session = await sessionStore.findById(project.lastSessionId);
		if (session && session.projectId === params.projectId) {
			throw redirect(302, `/sessions/${session.id}`);
		}
	}

	return {};
};

export const actions: Actions = {
	createWorktree: async ({ request, params }) => {
		const formData = await request.formData();
		const branchName = formData.get('branchName') as string | null;

		if (!branchName) {
			return { error: 'branchName is required' };
		}

		const projectPath = decodeProjectId(params.projectId);
		const projects = await projectStore.list();
		const project = projects.find((p) => p.path === projectPath);

		if (!project) {
			return { error: 'Project not found' };
		}

		try {
			await createWorktree(project.path, branchName);
		} catch (error) {
			return { error: error instanceof Error ? error.message : 'Failed to create worktree' };
		}

		return { success: true };
	},

	deleteWorktree: async ({ request, params }) => {
		const formData = await request.formData();
		const worktreePath = formData.get('worktreePath') as string | null;
		const branch = (formData.get('branch') as string | null) || null;
		const deleteBranch = formData.get('deleteBranch') !== 'false';

		if (!worktreePath) {
			return { error: 'worktreePath is required' };
		}

		const projectPath = decodeProjectId(params.projectId);
		const projects = await projectStore.list();
		const project = projects.find((p) => p.path === projectPath);

		if (!project) {
			return { error: 'Project not found' };
		}

		try {
			await deleteWorktree(project.path, worktreePath, branch, undefined, deleteBranch);

			// Remove all session entries for this worktree
			const allSessions = await sessionStore.list();
			const worktreeSessions = allSessions.filter((s) => s.worktreePath === worktreePath);
			for (const session of worktreeSessions) {
				await sessionStore.remove(session.id);
			}
		} catch (error) {
			return { error: error instanceof Error ? error.message : 'Failed to delete worktree' };
		}

		return { success: true };
	},

	createSession: async ({ request, params }) => {
		const formData = await request.formData();
		const cliProfileId = formData.get('cliProfileId') as string | null;
		const worktreePath = formData.get('worktreePath') as string | null;

		if (!cliProfileId || !worktreePath) {
			return { error: 'cliProfileId and worktreePath are required' };
		}

		const now = new Date().toISOString();
		const newSession = await sessionStore.upsert({
			id: '',
			cliProfileId,
			projectId: params.projectId,
			worktreePath,
			title: null,
			status: 'active',
			createdAt: now,
			lastActiveAt: now
		});

		// Set as last session and redirect
		const projectPath = decodeProjectId(params.projectId);
		await projectStore.updateLastSession(projectPath, newSession.id);
		throw redirect(303, `/sessions/${newSession.id}`);
	},

	renameSession: async ({ request }) => {
		const formData = await request.formData();
		const sessionId = formData.get('sessionId') as string | null;
		const title = formData.get('title') as string | null;

		if (!sessionId) {
			return { error: 'sessionId is required' };
		}

		const session = await sessionStore.findById(sessionId);
		if (!session) {
			return { error: 'Session not found' };
		}

		await sessionStore.upsert({
			...session,
			title: title?.trim() || null
		});

		return { success: true };
	},

	removeSessionEntry: async ({ request, params }) => {
		const formData = await request.formData();
		const sessionId = formData.get('sessionId') as string | null;

		if (!sessionId) {
			return { error: 'sessionId is required' };
		}

		await sessionStore.remove(sessionId);

		// Clear lastSessionId if it was this session
		const projectPath = decodeProjectId(params.projectId);
		const project = await projectStore.findByPath(projectPath);
		if (project?.lastSessionId === sessionId) {
			await projectStore.updateLastSession(projectPath, '');
		}

		throw redirect(303, `/projects/${params.projectId}`);
	}
};
