import { createProjectStore } from '$lib/server/projects';
import { createWorktree } from '$lib/server/git';
import { decodeProjectId } from '$lib/projects';
import type { Actions, PageServerLoad } from './$types';

const projectStore = createProjectStore();

export const load: PageServerLoad = async () => {
	// Page load function - can be used for page-specific data
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
	}
};
