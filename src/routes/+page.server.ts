import { createCliProfileStore } from '$lib/server/cli-profiles';
import type { Actions } from './$types';

const cliProfileStore = createCliProfileStore();

export const actions: Actions = {
	saveCliProfile: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string | null;
		const name = formData.get('name') as string | null;
		const command = formData.get('command') as string | null;
		const argsRaw = formData.get('args') as string | null;
		const envRaw = formData.get('env') as string | null;
		const resumeFlag = formData.get('resumeFlag') as string | null;
		const predefined = formData.get('predefined') === 'true';

		if (!name || !command) {
			return { error: 'Name and command are required' };
		}

		const args = argsRaw
			? argsRaw
					.split(',')
					.map((a) => a.trim())
					.filter((a) => a.length > 0)
			: [];

		let env: Record<string, string> = {};
		if (envRaw) {
			try {
				env = JSON.parse(envRaw);
			} catch {
				env = {};
			}
		}

		await cliProfileStore.upsert({
			id: (id || undefined) as unknown as string,
			name: name.trim(),
			command: command.trim(),
			args,
			env,
			predefined,
			resumeFlag: resumeFlag?.trim() || ''
		});

		return { success: true };
	},

	deleteCliProfile: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string | null;

		if (!id) {
			return { error: 'Profile id is required' };
		}

		await cliProfileStore.remove(id);
		return { success: true };
	}
};
