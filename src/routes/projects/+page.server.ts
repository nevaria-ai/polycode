import { projectStore } from '$lib/server/stores';
import { generateProjectColor, resolveProjectInput } from '$lib/server/projects';
import { redirect } from '@sveltejs/kit';

import { decodeProjectId, encodeProjectId } from '$lib/projects';
import type { Actions } from './$types';

export const actions: Actions = {
	add: async ({ request }) => {
		const formData = await request.formData();
		const path = formData.get('path') as string | null;

		if (!path) {
			return { error: 'path is required' };
		}

		const resolved = await resolveProjectInput(path);
		const project = await projectStore.upsert({
			...resolved,
			color: generateProjectColor()
		});

		// Redirect to the newly added project
		const projectId = encodeProjectId(project.path);
		throw redirect(303, `/projects/${projectId}`);
	},

	close: async ({ request }) => {
		const formData = await request.formData();
		const projectId = formData.get('projectId') as string | null;

		if (!projectId) {
			return { error: 'projectId is required' };
		}

		const projectPath = decodeProjectId(projectId);
		await projectStore.remove(projectPath);

		throw redirect(303, '/');
	}
};
