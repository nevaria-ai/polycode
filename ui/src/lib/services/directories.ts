import { api } from './api';
import type { DirectoryResponse } from '$lib/types/api';

export async function getDirectories(path?: string): Promise<DirectoryResponse> {
	const searchParams = path ? { q: path } : undefined;
	return api.get('directories', { searchParams }).json<DirectoryResponse>();
}
