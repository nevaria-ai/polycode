import path from 'node:path';

export type StoredProject = {
	name: string;
	path: string;
};

export type ResolvedProjectInput = {
	name: string;
	path: string;
};

export function normalizeProjectPath(input: string): string {
	return path.normalize(path.resolve(input)).replace(/\/$/, '') || '/';
}

export function encodeProjectId(projectPath: string): string {
	// Use btoa for browser compatibility (works in Node 16+ too)
	const utf8Bytes = new TextEncoder().encode(projectPath);
	const binaryString = String.fromCharCode(...utf8Bytes);
	return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function decodeProjectId(projectId: string): string {
	// Convert base64url back to base64
	let base64 = projectId.replace(/-/g, '+').replace(/_/g, '/');
	// Add padding if needed
	while (base64.length % 4) {
		base64 += '=';
	}
	const binaryString = atob(base64);
	const utf8Bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		utf8Bytes[i] = binaryString.charCodeAt(i);
	}
	return new TextDecoder().decode(utf8Bytes);
}
