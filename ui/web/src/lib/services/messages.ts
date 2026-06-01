import { api } from './api';
import type { MessageView, SubmitMessageApiInput } from '$lib/types/api';

export async function listMessages(projectId: string, sessionId: string): Promise<MessageView[]> {
	return api.get(`projects/${projectId}/sessions/${sessionId}/messages`).json<MessageView[]>();
}

export async function sendMessage(
	projectId: string,
	sessionId: string,
	data: SubmitMessageApiInput
): Promise<unknown> {
	return api.post(`projects/${projectId}/sessions/${sessionId}/messages`, { json: data }).json();
}
