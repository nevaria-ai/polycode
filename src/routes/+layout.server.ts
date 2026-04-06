import { createProjectStore } from '$lib/server/projects';
import type { LayoutServerLoad } from './$types';

const projectStore = createProjectStore();

export const load: LayoutServerLoad = async () => {
	const projects = await projectStore.list();

	return {
		projects
	};
};
