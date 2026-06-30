import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { Snippet } from 'svelte';
// LayoutData is the generated SvelteKit type for the layout's data prop.
// Using it here types the test fixtures against the real contract instead
// of the narrower ProjectTreeProjectInput, which avoids an unsafe cast.
import type { LayoutData } from './$types';
import RootLayout from './+layout.svelte';

// The layout component imports layout.css, which declares the body
// font-family stack. Rendering the layout (instead of the bare sidebar
// wrapper) lets Vite inject the bundled CSS into the test page so
// getComputedStyle() sees the real font stack rather than the browser
// default. Same pattern as layout-shell.svelte.spec.ts.
const noopChildren = (() => '') as unknown as Snippet;

type LayoutProjectTree = NonNullable<LayoutData['projectTree']>;

function renderLayout(projectTree: LayoutProjectTree = []) {
	// LayoutData expects the resolved Project shape (id, createdAt, ...),
	// even though the font tests only exercise the fields
	// materializeProjectTree reads. Type the fixtures against LayoutData so
	// they satisfy the real contract without an unsafe cast.
	return render(RootLayout, {
		data: { projects: [], initialSidebarOpen: true, projectTree },
		children: noopChildren
	});
}

// Sidebar expand calls updateProjectExpandedState; pass everything else
// through to the real implementations. Using importOriginal keeps the mock
// self-maintaining as $lib/services grows.
vi.mock('$lib/services', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/services')>();
	return {
		...actual,
		updateProjectExpandedState: vi.fn(async () => ({}))
	};
});

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
				id: 'repo-id',
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				expandedState: false,
				createdAt: '2026-04-09T10:00:00.000Z',
				defaultBranchLabel: null,
				sessions: [],
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
				id: 'repo-id',
				name: 'repo',
				displayName: 'acme/repo',
				path: '/repo',
				projectId: 'repo-id',
				expandedState: false,
				createdAt: '2026-04-09T10:00:00.000Z',
				defaultBranchLabel: null,
				sessions: [],
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
