import type { KnipConfig } from 'knip';

export default {
	// Generated shadcn-svelte primitives — treat as intentionally public surface
	ignore: ['src/components/ui/**'],
	// @tauri-apps/api: used by specta bindings (src/lib/bindings.ts)
	// @tauri-apps/cli: used by justfile / package scripts
	ignoreDependencies: ['@tauri-apps/api', '@tauri-apps/cli'],
	paths: {
		$components: ['src/components'],
		'$components/*': ['src/components/*'],
		$constants: ['../constants.json']
	}
} satisfies KnipConfig;
