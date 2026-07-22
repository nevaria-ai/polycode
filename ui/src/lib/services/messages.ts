import { api } from './api';
import type { SubmitMessageApiInput } from '$lib/types/api';

export async function sendMessage(
	projectId: string,
	sessionId: string,
	data: SubmitMessageApiInput
): Promise<unknown> {
	return api.post(`projects/${projectId}/sessions/${sessionId}/messages`, { json: data }).json();
}
