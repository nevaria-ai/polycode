import { getSession } from '$lib/services';
import type { PageLoad } from './$types';
import type { SessionViewData } from '$lib/types/api';

export const ssr = false;

export const load: PageLoad = async ({ params, url, depends }): Promise<SessionViewData> => {
	depends(`session:${params.sessionId}`);
	const projectId = url.searchParams.get('project') ?? '';

	try {
		return await getSession(projectId, params.sessionId);
	} catch {
		return {
			session: null,
			messages: [],
			pinnedContext: [],
			hasSummary: false,
			providerRuns: []
		};
	}
};
