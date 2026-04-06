import { createProjectStore } from '$lib/server/projects';
import { decodeProjectId } from '$lib/projects';
import type { PageServerLoad } from './$types';

const projectStore = createProjectStore();

export const load: PageServerLoad = async ({ params }) => {
	const projectPath = decodeProjectId(params.projectId);
	const projects = await projectStore.list();
	const project = projects.find((p) => p.path === projectPath) ?? null;

	return {
		project
	};
};
