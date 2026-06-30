import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { Snippet } from 'svelte';
import type { ProjectTreeProjectInput } from '$lib/project-tree';
import RootLayout from './+layout.svelte';

// The layout component imports layout.css, which declares the body
// font-family stack. Rendering the layout (instead of the bare sidebar
// wrapper) lets Vite inject the bundled CSS into the test page so
// getComputedStyle() sees the real font stack rather than the browser
// default. Same pattern as layout-shell.svelte.spec.ts.
const noopChildren = (() => '') as unknown as Snippet;

function renderLayout(projectTree: ProjectTreeProjectInput[] = []) {
	// LayoutData expects the resolved Project shape (id, createdAt, ...),
	// but the font tests only need the fields materializeProjectTree reads.
	// Cast through the runtime input shape to avoid leaking server-only
	// fields into the test fixtures.
	return render(RootLayout, {
		data: { projects: [], initialSidebarOpen: true, projectTree } as never,
		children: noopChildren
	});
}

// Sidebar expand/collapse and other interactions call into $lib/services.
// Mock the full module surface so no real fetches fire against a missing
// backend. Mirrors the pattern in AppSidebar.svelte.spec.ts.
vi.mock('$lib/services', () => ({
	api: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), put: vi.fn() },
	getProjects: vi.fn(async () => []),
	createProject: vi.fn(async () => ({ project: { id: 'test' } })),
	closeProject: vi.fn(async () => undefined),
	updateProjectExpandedState: vi.fn(async () => ({})),
	listAllSessions: vi.fn(async () => []),
	listSessions: vi.fn(async () => []),
	createSession: vi.fn(async () => ({ session: {} })),
	getSession: vi.fn(async () => ({})),
	deleteSession: vi.fn(async () => undefined),
	updateSessionTitle: vi.fn(async () => ({ session: {} })),
	archiveSession: vi.fn(async () => ({ session: {} })),
	listWorktrees: vi.fn(async () => []),
	createWorktree: vi.fn(async () => ({ worktree: {} })),
	renameWorktree: vi.fn(async () => undefined),
	deleteWorktree: vi.fn(async () => undefined),
	listMessages: vi.fn(async () => []),
	sendMessage: vi.fn(async () => undefined),
	getDirectories: vi.fn(async () => ({ suggestions: [], exists: false }))
}));

const SYSTEM_FONT_STACK =
	'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function measureElementFont(element: Element): {
	declaredFamily: string;
	fontSize: string;
	fontWeight: string;
	systemWidth: number;
	fallbackWidth: number;
} {
	const computed = getComputedStyle(element);
	const text = element.textContent ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

	const probe = document.createElement('span');
	probe.style.cssText = `
		position: absolute;
		visibility: hidden;
		white-space: nowrap;
		font-size: ${computed.fontSize};
		font-weight: ${computed.fontWeight};
		letter-spacing: ${computed.letterSpacing};
		line-height: ${computed.lineHeight};
	`;
	probe.textContent = text;
	document.body.appendChild(probe);

	probe.style.fontFamily = SYSTEM_FONT_STACK;
	const systemWidth = probe.getBoundingClientRect().width;

	probe.style.fontFamily = 'Georgia, serif';
	const fallbackWidth = probe.getBoundingClientRect().width;

	probe.style.fontFamily = computed.fontFamily;
	const declaredWidth = probe.getBoundingClientRect().width;

	document.body.removeChild(probe);

	const usingSystem = Math.abs(declaredWidth - systemWidth) < 0.5;

	return {
		declaredFamily: computed.fontFamily,
		fontSize: computed.fontSize,
		fontWeight: computed.fontWeight,
		systemWidth: usingSystem ? declaredWidth : 0,
		fallbackWidth
	};
}

describe('font rendering', () => {
	beforeEach(() => {
		localStorage.clear();
		cleanup();
	});

	it('body uses system font stack, not a custom web font', async () => {
		renderLayout();

		const computed = getComputedStyle(document.body).fontFamily;
		expect(computed).toContain('system-ui');
		expect(computed).toContain('Segoe UI');
		expect(computed).toContain('Helvetica Neue');
	});

	it('no custom web font faces are loaded', async () => {
		renderLayout();

		const loadedFonts = Array.from(document.fonts);
		const customFonts = loadedFonts.filter(
			(f) =>
				!f.family.includes('system') &&
				!f.family.includes('Times') &&
				!f.family.includes('serif') &&
				f.status === 'loaded'
		);

		const lexendFaces = loadedFonts.filter((f) => f.family.includes('Lexend'));
		expect(lexendFaces.length).toBe(0);
		expect(customFonts.length).toBe(0);
	});

	it('body text renders using the system font stack, not a serif fallback', async () => {
		renderLayout();

		const result = measureElementFont(document.body);
		expect(result.systemWidth).toBeGreaterThan(0);
		expect(result.systemWidth).not.toBe(result.fallbackWidth);
	});

	it('sidebar session title uses system font stack', async () => {
		renderLayout([
			{
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				expandedState: false,
				worktrees: [
					{
						id: 'test-wt-id',
						name: 'test-wt-name',
						path: '/repo',
						branch: 'main',
						sessions: [
							{
								id: 'session-1',
								title: 'Active Session Title Here',
								projectId: 'repo-id',
								worktreePath: '/repo',
								status: 'active',
								worktreeId: 'wt-1',
								createdAt: '2026-04-09T10:00:00.000Z',
								lastActiveAt: '2026-04-09T10:00:00.000Z'
							}
						]
					}
				]
			}
		]);

		await page.getByRole('button', { name: /repo/i }).click();
		(document.querySelector('[aria-label="Expand main branch"]') as HTMLElement | null)?.click();

		const sessionLink = document.querySelector('.sidebar-session-link');
		expect(sessionLink).not.toBeNull();

		const result = measureElementFont(sessionLink!);
		expect(result.declaredFamily).toContain('system-ui');
		expect(result.systemWidth).toBeGreaterThan(0);
	});

	it('sidebar project name uses system font stack', async () => {
		renderLayout([
			{
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				expandedState: false,
				worktrees: [
					{
						id: 'test-wt-id',
						name: 'test-wt-name',
						path: '/repo',
						branch: 'main',
						sessions: []
					}
				]
			}
		]);

		const projectMain = document.querySelector('.project-main');
		expect(projectMain).not.toBeNull();

		const result = measureElementFont(projectMain!);
		expect(result.declaredFamily).toContain('system-ui');
		expect(result.systemWidth).toBeGreaterThan(0);
	});

	it('sidebar New Session button uses system font stack', async () => {
		renderLayout();

		const newSessionLink = document.querySelector('a[href="/"]');
		expect(newSessionLink).not.toBeNull();

		const result = measureElementFont(newSessionLink!);
		expect(result.declaredFamily).toContain('system-ui');
		expect(result.systemWidth).toBeGreaterThan(0);
	});
});
