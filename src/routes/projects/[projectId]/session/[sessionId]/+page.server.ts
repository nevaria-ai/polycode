import { createProjectStore } from '$lib/server/projects';
import { createSessionStore } from '$lib/server/sessions';
import { decodeProjectId } from '$lib/projects';
import type { PageServerLoad } from './$types';

const projectStore = createProjectStore();
const sessionStore = createSessionStore();

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
