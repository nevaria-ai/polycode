import { createProjectStore } from '$lib/server/projects';
import { createCliProfileStore } from '$lib/server/cli-profiles';
import type { LayoutServerLoad } from './$types';

const projectStore = createProjectStore();
const cliProfileStore = createCliProfileStore();

export const load: LayoutServerLoad = async () => {
	const projects = await projectStore.list();
	const cliProfiles = await cliProfileStore.list();

	return {
		projects,
		cliProfiles
	};
};
