import ky from 'ky';

export const api = ky.create({
	prefix: '/api',
	timeout: 30000,
	retry: { limit: 2, methods: ['GET'] },
	hooks: {
		afterResponse: [
			async ({ response }) => {
				if (!response.ok) {
					const body = (await response.json().catch(() => ({}))) as {
						message?: string;
						error?: string;
					};
					const message = body.message || body.error || response.statusText;
					throw new Error(message);
				}
			}
		]
	}
});
