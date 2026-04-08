import { projectStore, cliProfileStore } from '$lib/server/stores';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const projects = await projectStore.list();
	const cliProfiles = await cliProfileStore.list();

	return {
		projects,
		cliProfiles
	};
};
