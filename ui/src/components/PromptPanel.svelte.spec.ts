import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import PromptPanel from './PromptPanel.svelte';

describe('PromptPanel', () => {
	it('renders prompt controls and keeps send disabled while empty', () => {
		render(PromptPanel, {
			value: '',
			placeholder: 'Enter your query!'
		});

		expect(screen.getByTestId('prompt-panel')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Enter your query!')).toBeInTheDocument();
		expect(screen.getByTestId('prompt-panel-footer')).toBeInTheDocument();
		expect(screen.getByTestId('prompt-panel-attach')).toBeInTheDocument();
		expect(screen.getByTestId('prompt-panel-send')).toBeDisabled();
		expect(screen.queryByTestId('prompt-panel-model-selector')).not.toBeInTheDocument();
	});

	it('submits on Enter and via the send button when there is content', async () => {
		const user = userEvent.setup();
		const onsubmit = vi.fn();

		render(PromptPanel, {
			value: 'hello',
			placeholder: 'Enter your query!',
			onsubmit
		});

		const send = screen.getByTestId('prompt-panel-send');
		expect(send).toBeEnabled();

		await user.click(send);
		expect(onsubmit).toHaveBeenCalledTimes(1);

		await user.type(screen.getByPlaceholderText('Enter your query!'), '{Enter}');
		expect(onsubmit).toHaveBeenCalledTimes(2);
	});
});
