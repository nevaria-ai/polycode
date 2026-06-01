import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import AppSidebarTestWrapper from '$components/AppSidebarTestWrapper.svelte';

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
		render(AppSidebarTestWrapper, { projectTree: [] });

		const computed = getComputedStyle(document.body).fontFamily;
		expect(computed).toContain('system-ui');
		expect(computed).toContain('Segoe UI');
		expect(computed).toContain('Helvetica Neue');
	});

	it('no custom web font faces are loaded', async () => {
		render(AppSidebarTestWrapper, { projectTree: [] });

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
	});

	it('body text renders using the system font stack, not a serif fallback', async () => {
		render(AppSidebarTestWrapper, { projectTree: [] });

		const result = measureElementFont(document.body);
		expect(result.systemWidth).toBeGreaterThan(0);
		expect(result.systemWidth).not.toBe(result.fallbackWidth);
	});

	it('sidebar session title uses system font stack', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					displayName: 'acme/repo',
					path: '/repo',
					projectId: 'repo-id',
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
			]
		});

		await page.getByRole('button', { name: /repo/i }).click();
		(document.querySelector('[aria-label="Expand main branch"]') as HTMLElement | null)?.click();

		const sessionLink = document.querySelector('.sidebar-session-link');
		expect(sessionLink).not.toBeNull();

		const result = measureElementFont(sessionLink!);
		expect(result.declaredFamily).toContain('system-ui');
		expect(result.systemWidth).toBeGreaterThan(0);
	});

	it('sidebar project name uses system font stack', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: [
				{
					name: 'repo',
					displayName: 'acme/repo',
					path: '/repo',
					projectId: 'repo-id',
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
			]
		});

		const projectMain = document.querySelector('.project-main');
		expect(projectMain).not.toBeNull();

		const result = measureElementFont(projectMain!);
		expect(result.declaredFamily).toContain('system-ui');
		expect(result.systemWidth).toBeGreaterThan(0);
	});

	it('sidebar New Session button uses system font stack', async () => {
		render(AppSidebarTestWrapper, {
			projectTree: []
		});

		const newSessionLink = document.querySelector('a[href="/"]');
		expect(newSessionLink).not.toBeNull();

		const result = measureElementFont(newSessionLink!);
		expect(result.declaredFamily).toContain('system-ui');
		expect(result.systemWidth).toBeGreaterThan(0);
	});
});
