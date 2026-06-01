import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SessionPage from './+page.svelte';

const { appPage, setInitSessionFields, clearInitSessionFields } = vi.hoisted(() => {
	const state = {
		url: { pathname: '/sessions/session-12345678' },
		initSessionFields: null as { prompt: string } | null
	};

	return {
		appPage: state,
		setInitSessionFields: (fields: { prompt: string } | null) => {
			state.initSessionFields = fields;
		},
		clearInitSessionFields: () => {
			state.initSessionFields = null;
		}
	};
});

vi.mock('$app/state', () => ({
	page: appPage
}));

const replaceStateMock = vi.fn();
vi.mock('$app/navigation', () => ({
	replaceState: replaceStateMock,
	invalidateAll: vi.fn()
}));

const sendMessageMock = vi.fn();
vi.mock('$lib/services', () => ({
	sendMessage: sendMessageMock,
	updateSessionTitle: vi.fn()
}));

const baseData = {
	projects: [],
	projectTree: [],
	initialSidebarOpen: true,
	session: {
		id: 'session-12345678',
		projectId: 'project-1',
		worktreePath: '/repo',
		worktreeId: null,
		title: 'Imported conversation layout',
		status: 'active' as const,
		version: 1,
		hasSummary: false,
		createdAt: '2026-04-10T00:00:00.000Z',
		updatedAt: '2026-04-10T00:00:00.000Z',
		lastActiveAt: '2026-04-10T00:00:00.000Z'
	},
	messages: [],
	pinnedContext: [],
	hasSummary: false,
	providerRuns: []
};

describe('sessions/[sessionId]/+page.svelte', () => {
	beforeEach(() => {
		cleanup();
		clearInitSessionFields();
		replaceStateMock.mockClear();
		sendMessageMock.mockClear();
		sendMessageMock.mockResolvedValue({ messageId: 'msg-1', artifacts: [] });
	});

	it('renders the current session title inside the page content', async () => {
		const screen = render(SessionPage, {
			data: baseData
		});

		expect(screen.getByText('Imported conversation layout')).toBeTruthy();
	});

	it('focuses the rename input when entering rename mode', async () => {
		render(SessionPage, { data: baseData });

		await page.getByRole('button', { name: 'Rename session' }).click();

		await expect.poll(() => document.activeElement?.getAttribute('type')).toBe('text');
	});

	it('renders the shared prompt panel for active sessions', async () => {
		const { container } = render(SessionPage, { data: baseData });

		expect(container.querySelector('[data-testid="prompt-panel"]')).not.toBeNull();
		expect(container.querySelector('textarea[placeholder="Type a message..."]')).not.toBeNull();
		expect(container.querySelector('[data-testid="prompt-panel-send"]')).not.toBeNull();
	});

	it('consumes initSessionFields and submits the initial prompt on mount', async () => {
		setInitSessionFields({ prompt: 'Hello world' });

		render(SessionPage, { data: baseData });

		await expect.poll(() => sendMessageMock.mock.calls.length).toBeGreaterThan(0);

		expect(sendMessageMock).toHaveBeenCalledTimes(1);
		expect(sendMessageMock).toHaveBeenCalledWith('project-1', 'session-12345678', {
			content: 'Hello world'
		});
		expect(replaceStateMock).toHaveBeenCalled();
		const replacedState = replaceStateMock.mock.calls[0][1];
		expect(replacedState.initSessionFields).toBeNull();
	});

	it('does not call submitMessage when initSessionFields is absent', async () => {
		clearInitSessionFields();

		render(SessionPage, { data: baseData });

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(sendMessageMock).not.toHaveBeenCalled();
	});

	it('does not resubmit after revisit with no initSessionFields', async () => {
		clearInitSessionFields();

		render(SessionPage, { data: baseData });

		await new Promise((resolve) => setTimeout(resolve, 50));
		sendMessageMock.mockClear();

		cleanup();
		render(SessionPage, { data: baseData });

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(sendMessageMock).not.toHaveBeenCalled();
	});

	it('shows the submitted message in the conversation after init submit', async () => {
		setInitSessionFields({ prompt: 'Build a login form' });
		sendMessageMock.mockResolvedValue({ messageId: 'msg-1', artifacts: [] });

		render(SessionPage, { data: baseData });

		await expect.poll(() => document.body.textContent).toContain('Build a login form');
	});
});
