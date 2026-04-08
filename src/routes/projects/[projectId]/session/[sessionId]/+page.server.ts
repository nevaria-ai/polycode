import { projectStore, sessionStore } from '$lib/server/stores';

import { decodeProjectId } from '$lib/projects';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const session = await sessionStore.findById(params.sessionId);

	// Always set lastSessionId when visiting a session page
	const projectPath = decodeProjectId(params.projectId);
	await projectStore.updateLastSession(projectPath, params.sessionId);

	if (!session || session.projectId !== params.projectId) {
		return { session: null };
	}

	return { session };
};
