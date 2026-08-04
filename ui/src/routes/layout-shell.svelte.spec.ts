import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import RootLayout from './+layout.svelte';

function renderLayout(props: { initialSidebarOpen: boolean } = { initialSidebarOpen: true }) {
	const children = (() => '') as unknown as Snippet;
	return render(RootLayout, {
		data: { initialSidebarOpen: props.initialSidebarOpen, projects: [] },
		children
	});
}

describe('root layout sidebar shell', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('keeps the resizable shell and content header mounted when closing the sidebar', async () => {
		const user = userEvent.setup();
		renderLayout({ initialSidebarOpen: true });

		const paneGroup = document.querySelector('[data-slot="resizable-pane-group"]');
		const headerBefore = screen.getByTestId('content-header');
		expect(paneGroup).not.toBeNull();
		expect(screen.queryByLabelText('Show sidebar')).not.toBeInTheDocument();
		expect(screen.getByTestId('content-header-placeholder').querySelector('svg')).not.toBeNull();
		expect(screen.getByTestId('sidebar-app-name')).toHaveTextContent('ESK CODE');

		await user.click(screen.getByLabelText('Hide sidebar'));

		const showBtn = await screen.findByLabelText('Show sidebar', {}, { timeout: 2000 });
		expect(document.querySelector('[data-slot="resizable-pane-group"]')).toBe(paneGroup);
		expect(screen.getByTestId('content-header')).toBe(headerBefore);
		expect(headerBefore.contains(showBtn)).toBe(true);
	});

	it('shows the Show sidebar button in the content header when the sidebar starts closed', () => {
		renderLayout({ initialSidebarOpen: false });

		const header = screen.getByTestId('content-header');
		const showBtn = screen.getByLabelText('Show sidebar');
		expect(header.contains(showBtn)).toBe(true);
	});
});
