import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { SettingsDialog } from './index.js';

describe('SettingsDialog', () => {
	it('renders the Models section', () => {
		render(SettingsDialog, {
			open: true
		});

		expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
		expect(screen.getByText('Model settings are coming soon.')).toBeInTheDocument();
	});
});
