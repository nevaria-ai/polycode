import { commands, unwrapCommand, type ApiSession, type SessionViewResponse } from '$lib/command';
import type { PageLoad } from './$types';

export const ssr = false;

export type SessionPageData = Omit<SessionViewResponse, 'session'> & {
	session: ApiSession | null;
};

export const load: PageLoad = async ({ params, url, depends }): Promise<SessionPageData> => {
	depends(`session:${params.sessionId}`);
	const projectId = url.searchParams.get('project') ?? '';

	try {
		return await commands.getSession(projectId, params.sessionId).then(unwrapCommand);
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
