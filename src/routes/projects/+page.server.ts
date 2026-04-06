import { redirect } from '@sveltejs/kit';
import {
	createProjectStore,
	generateProjectColor,
	resolveProjectInput
} from '$lib/server/projects';
import { decodeProjectId } from '$lib/projects';
import type { Actions } from './$types';

const projectStore = createProjectStore();

export const actions: Actions = {
	open: async ({ request }) => {
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

		throw redirect(303, `${Buffer.from(project.path, 'utf8').toString('base64url')}`);
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
