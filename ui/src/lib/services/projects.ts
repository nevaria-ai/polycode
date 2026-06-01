import { api } from './api';
import type { Project } from '$lib/types/api';

export async function getProjects(): Promise<Project[]> {
	return api.get('projects').json<Project[]>();
}

export async function createProject(path: string): Promise<{ project: Project }> {
	return api.post('projects', { json: { path } }).json();
}

export async function closeProject(id: string): Promise<void> {
	await api.delete(`projects/${id}`);
}

export async function updateProjectExpandedState(
	id: string,
	expandedState: boolean
): Promise<Project> {
	return api.patch(`projects/${id}/expanded-state`, { json: { expandedState } }).json();
}
