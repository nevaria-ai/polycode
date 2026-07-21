import { api } from './api';
import type { ProjectTree } from '$lib/types/api';

export async function getProjects(): Promise<ProjectTree[]> {
	return api.get('projects').json<ProjectTree[]>();
}

export async function createProject(path: string): Promise<{ id: string }> {
	return api.post('projects', { json: { path } }).json();
}

export async function closeProject(id: string): Promise<void> {
	await api.delete(`projects/${id}`);
}

export async function updateProjectExpandedState(
	id: string,
	expandedState: boolean
): Promise<void> {
	await api.patch(`projects/${id}/expanded-state`, { json: { expandedState } });
}
