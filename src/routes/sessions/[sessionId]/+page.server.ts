import { projectStore, sessionStore } from '$lib/server/stores';

import { decodeProjectId } from '$lib/projects';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const session = await sessionStore.findById(params.sessionId);

	if (!session) {
		return { session: null };
	}

	// Always set lastSessionId when visiting a session page.
	const projectPath = decodeProjectId(session.projectId);
	await projectStore.updateLastSession(projectPath, params.sessionId);

	return { session };
};
