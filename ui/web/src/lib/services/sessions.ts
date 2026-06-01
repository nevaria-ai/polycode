import { api } from './api';
import type {
	Session,
	SessionViewData,
	CreateSessionApiInput,
	RenameSessionApiInput,
	ArchiveSessionApiInput
} from '$lib/types/api';

export async function listAllSessions(): Promise<Session[]> {
	return api.get('sessions').json<Session[]>();
}

export async function listSessions(projectId: string): Promise<Session[]> {
	return api.get(`projects/${projectId}/sessions`).json<Session[]>();
}

export async function createSession(
	projectId: string,
	input: CreateSessionApiInput
): Promise<{ session: Session }> {
	return api.post(`projects/${projectId}/sessions`, { json: input }).json();
}

export async function getSession(projectId: string, sessionId: string): Promise<SessionViewData> {
	return api.get(`projects/${projectId}/sessions/${sessionId}`).json();
}

export async function deleteSession(projectId: string, sessionId: string): Promise<void> {
	await api.delete(`projects/${projectId}/sessions/${sessionId}`);
}

export async function updateSessionTitle(
	projectId: string,
	sessionId: string,
	input: RenameSessionApiInput
): Promise<{ session: Session }> {
	return api.patch(`projects/${projectId}/sessions/${sessionId}/title`, { json: input }).json();
}

export async function archiveSession(
	projectId: string,
	sessionId: string,
	input: ArchiveSessionApiInput
): Promise<{ session: Session }> {
	return api.post(`projects/${projectId}/sessions/${sessionId}/archive`, { json: input }).json();
}
