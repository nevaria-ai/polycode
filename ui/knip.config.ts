import type { KnipConfig } from 'knip';

export default {
	// Generated shadcn-svelte primitives — treat as intentionally public surface
	ignore: ['src/components/ui/**'],
	// Used by gitignored tauri-specta bindings (`src/lib/bindings.ts`)
	ignoreDependencies: ['@tauri-apps/api'],
	paths: {
		$components: ['src/components'],
		'$components/*': ['src/components/*'],
		$constants: ['../constants.json']
	}
} satisfies KnipConfig;
