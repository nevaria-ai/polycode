import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import PromptPanel from './PromptPanel.svelte';
describe('PromptPanel', () => {
	beforeEach(() => {
		cleanup();
	});

	it('renders the prompt area and footer controls inside one shared panel surface', async () => {
		const { container } = render(PromptPanel, {
			value: '',
			placeholder: 'Enter your query!'
		});

		expect(container.querySelector('[data-testid="prompt-panel"]')).not.toBeNull();
		expect(container.querySelector('textarea[placeholder="Enter your query!"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="prompt-panel-footer"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="prompt-panel-attach"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="prompt-panel-send"]')).not.toBeNull();
	});

	it('renders a one-line prompt surface with footer controls', async () => {
		const { container } = render(PromptPanel, {
			value: '',
			placeholder: 'Enter your query!'
		});

		const textarea = container.querySelector('textarea[placeholder="Enter your query!"]');

		expect(container.querySelector('[data-testid="prompt-panel"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="prompt-panel-footer"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="prompt-panel-attach"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="prompt-panel-send"]')).not.toBeNull();
		expect(textarea?.className).toContain('min-h-0');
		expect(textarea?.className).toContain('max-h-32');
	});

	it('does not render model selector', async () => {
		const { container } = render(PromptPanel, {
			value: '',
			placeholder: 'Enter your query!'
		});

		expect(container.querySelector('[data-testid="prompt-panel-model-selector"]')).toBeNull();
	});
});
