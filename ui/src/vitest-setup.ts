import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// SvelteKit layout/effects gate on `$app/environment.browser`. Vitest runs in
// Node, so without this mock those `$effect`s never run (unlike real-browser
// Vitest browser mode).
vi.mock('$app/environment', () => ({
	browser: true,
	building: false,
	dev: true,
	version: 'test'
}));

// Node may inject experimental localStorage without a working Storage API
// (clear/getItem/setItem). Prefer a simple in-memory shim for happy-dom tests.
if (typeof globalThis.localStorage?.clear !== 'function') {
	const store = new Map<string, string>();
	const storage: Storage = {
		get length() {
			return store.size;
		},
		clear() {
			store.clear();
		},
		getItem(key: string) {
			return store.has(key) ? (store.get(key) ?? null) : null;
		},
		setItem(key: string, value: string) {
			store.set(key, String(value));
		},
		removeItem(key: string) {
			store.delete(key);
		},
		key(index: number) {
			return [...store.keys()][index] ?? null;
		}
	};
	Object.defineProperty(globalThis, 'localStorage', {
		value: storage,
		configurable: true,
		writable: true
	});
	if (typeof window !== 'undefined') {
		Object.defineProperty(window, 'localStorage', {
			value: storage,
			configurable: true,
			writable: true
		});
	}
}

afterEach(async () => {
	cleanup();
	// bits-ui body-scroll-lock schedules resetBodyStyle ~24ms after dialog unlock.
	// Flush that timer while happy-dom's `document` is still alive to avoid
	// uncaught "document is not defined" after the suite tears down.
	await new Promise((resolve) => setTimeout(resolve, 30));
});
