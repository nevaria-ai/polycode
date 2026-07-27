import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SessionPage from './+page.svelte';

const {
	appPage,
	setInitSessionFields,
	clearInitSessionFields,
	replaceStateMock,
	sendMessageMock,
	invalidateMock
} = vi.hoisted(() => {
	const state = {
		url: { pathname: '/sessions/session-12345678' },
		state: { initSessionFields: null as { prompt: string } | null }
	};

	return {
		appPage: state,
		setInitSessionFields: (fields: { prompt: string } | null) => {
			state.state.initSessionFields = fields;
		},
		clearInitSessionFields: () => {
			state.state.initSessionFields = null;
		},
		replaceStateMock: vi.fn(),
		sendMessageMock: vi.fn(),
		invalidateMock: vi.fn(async () => {})
	};
});

vi.mock('$app/state', () => ({
	page: appPage
}));

vi.mock('$app/navigation', () => ({
	replaceState: replaceStateMock,
	invalidate: invalidateMock
}));

vi.mock('$lib/bindings', () => ({
	commands: {
		sendMessage: sendMessageMock,
		updateSessionTitle: vi.fn(async () => ({
			status: 'ok' as const,
			data: { session: null }
		}))
	}
}));

const baseData = {
	projectTree: [],
	initialSidebarOpen: true,
	session: {
		id: 'session-12345678',
		projectId: 'project-1',
		worktreeId: 'wt-1',
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
		clearInitSessionFields();
		replaceStateMock.mockClear();
		sendMessageMock.mockClear();
		invalidateMock.mockClear();
		sendMessageMock.mockResolvedValue({
			status: 'ok' as const,
			data: {
				id: 'msg-1',
				sessionId: 'session-12345678',
				role: 'user',
				position: 0,
				content: 'hello',
				providerRunId: null,
				createdAt: '2026-04-10T00:00:00.000Z',
				parts: []
			}
		});
	});

	it('renders the current session title inside the page content', () => {
		render(SessionPage, {
			data: baseData
		});

		expect(screen.getByText('Imported conversation layout')).toBeInTheDocument();
	});

	it('focuses the rename input when entering rename mode', async () => {
		const user = userEvent.setup();
		render(SessionPage, { data: baseData });

		await user.click(screen.getByRole('button', { name: 'Rename session' }));

		await waitFor(() => {
			expect(document.activeElement?.getAttribute('type')).toBe('text');
		});
	});

	it('renders the shared prompt panel for active sessions', () => {
		const { container } = render(SessionPage, { data: baseData });

		expect(container.querySelector('[data-testid="prompt-panel"]')).not.toBeNull();
		expect(container.querySelector('textarea[placeholder="Type a message..."]')).not.toBeNull();
		expect(container.querySelector('[data-testid="prompt-panel-send"]')).not.toBeNull();
	});

	it('consumes initSessionFields and submits the initial prompt on mount', async () => {
		setInitSessionFields({ prompt: 'Hello world' });

		render(SessionPage, { data: baseData });

		await waitFor(() => {
			expect(sendMessageMock.mock.calls.length).toBeGreaterThan(0);
		});

		expect(sendMessageMock).toHaveBeenCalledTimes(1);
		expect(sendMessageMock).toHaveBeenCalledWith('project-1', 'session-12345678', {
			content: 'Hello world',
			mentions: null,
			slashCommand: null
		});
		expect(replaceStateMock).toHaveBeenCalled();
		const replacedState = replaceStateMock.mock.calls[0][1];
		expect(replacedState.initSessionFields).toBeNull();
	});

	it('does not call submitMessage when initSessionFields is absent', async () => {
		clearInitSessionFields();

		render(SessionPage, { data: baseData });

		// Allow mount effects to flush; assert no submit was queued.
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(sendMessageMock).not.toHaveBeenCalled();
	});

	it('does not resubmit after revisit with no initSessionFields', async () => {
		clearInitSessionFields();

		const first = render(SessionPage, { data: baseData });

		await new Promise((resolve) => setTimeout(resolve, 50));
		sendMessageMock.mockClear();

		first.unmount();
		render(SessionPage, { data: baseData });

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(sendMessageMock).not.toHaveBeenCalled();
	});

	it('submits the init prompt and invalidates the session load key', async () => {
		setInitSessionFields({ prompt: 'Build a login form' });
		sendMessageMock.mockResolvedValue({
			status: 'ok' as const,
			data: {
				id: 'msg-1',
				sessionId: 'session-12345678',
				role: 'user',
				position: 0,
				content: 'Build a login form',
				providerRunId: null,
				createdAt: '2026-04-10T00:00:00.000Z',
				parts: []
			}
		});

		render(SessionPage, { data: baseData });

		await waitFor(() => {
			expect(sendMessageMock.mock.calls.length).toBeGreaterThan(0);
		});
		await waitFor(() => {
			expect(invalidateMock.mock.calls.length).toBeGreaterThan(0);
		});

		expect(sendMessageMock).toHaveBeenCalledWith('project-1', 'session-12345678', {
			content: 'Build a login form',
			mentions: null,
			slashCommand: null
		});
		expect(invalidateMock).toHaveBeenCalledWith('session:session-12345678');
	});
});
