export { commands } from '$lib/bindings';
export type * from '$lib/bindings';

import type { AppError } from '$lib/bindings';

export type CommandResult<T> = { status: 'ok'; data: T } | { status: 'error'; error: AppError };

/** Unwrap a tauri-specta command result; throws Error with a display message on failure. */
export function unwrapCommand<T>(result: CommandResult<T>): T {
	if (result.status === 'error') {
		throw new Error(formatAppError(result.error));
	}
	return result.data;
}

function formatAppError(error: AppError | Record<string, unknown>): string {
	// Runtime IPC shape from AppErrorKind Serialize: { kind, message }
	if (error && typeof error === 'object' && 'message' in error) {
		const message = (error as { message?: unknown }).message;
		if (typeof message === 'string' && message.length > 0) return message;
	}
	// Specta Type shape for the thiserror enum: { NotFound: string } | …
	if (error && typeof error === 'object') {
		for (const key of ['NotFound', 'BadRequest', 'Database'] as const) {
			const value = (error as Record<string, unknown>)[key];
			if (typeof value === 'string' && value.length > 0) return value;
		}
	}
	return 'Command failed';
}
