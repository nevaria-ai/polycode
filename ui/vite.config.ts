import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';

// Load .env file
dotenv.config();

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), svelteTesting({ autoCleanup: false })],
	// Tauri expects a fixed port; don't clear the screen over rust errors.
	clearScreen: false,
	server: {
		port: 5173,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 5174
				}
			: undefined,
		// Allow importing repo-root `constants.json` from `ui/`
		fs: {
			allow: [repoRoot]
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'unit',
					environment: 'node',
					include: ['src/lib/**/*.{test,spec}.{js,ts}']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					environment: 'happy-dom',
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./src/vitest-setup.ts']
				}
			}
		]
	}
});
