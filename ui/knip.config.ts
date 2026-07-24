import type { KnipConfig } from 'knip';

export default {
	// Generated shadcn-svelte primitives — treat as intentionally public surface
	ignore: ['src/components/ui/**'],
	paths: {
		$components: ['src/components'],
		'$components/*': ['src/components/*'],
		$constants: ['../constants.json']
	}
} satisfies KnipConfig;
