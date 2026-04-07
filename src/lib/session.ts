import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { browser } from '$app/environment';

/**
 * Navigate to a new session for the given project.
 * Currently a placeholder — the actual session route will be implemented later.
 */
export async function openNewSession(projectId: string) {
	if (!browser) return;
	await goto(resolve('/projects/[projectId]', { projectId }), { keepFocus: true });
}
