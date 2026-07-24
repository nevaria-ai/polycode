import { api } from './api';
import type {
	Session,
	SessionViewData,
	CreateSessionApiInput,
	RenameSessionApiInput
} from '$lib/types/api';

export async function createSession(
	projectId: string,
	input: CreateSessionApiInput
): Promise<{ session: Session }> {
	return api.post(`projects/${projectId}/sessions`, { json: input }).json();
}

export async function getSession(projectId: string, sessionId: string): Promise<SessionViewData> {
	return api.get(`projects/${projectId}/sessions/${sessionId}`).json();
}

export async function updateSessionTitle(
	projectId: string,
	sessionId: string,
	input: RenameSessionApiInput
): Promise<{ session: Session }> {
	return api.patch(`projects/${projectId}/sessions/${sessionId}/title`, { json: input }).json();
}
