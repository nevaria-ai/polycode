import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ProjectName, { getOwnerPrefix } from './ProjectName.svelte';

describe('ProjectName', () => {
	describe('getOwnerPrefix', () => {
		it('returns the owner/ prefix when displayName starts with it', () => {
			expect(getOwnerPrefix('radch-ai', 'radch-ai/esk-code')).toBe('radch-ai/');
		});

		it('returns null when owner is null (plain folder)', () => {
			expect(getOwnerPrefix(null, 'esk-code')).toBeNull();
		});

		it('returns null when displayName was demoted by collision', () => {
			// owner is set but displayName is now parent/folder, not owner/repo
			expect(getOwnerPrefix('radch-ai', 'work/esk-code')).toBeNull();
		});

		it('returns null when owner matches but displayName has no suffix', () => {
			// edge case: displayName is exactly "radch-ai/" with empty repo
			expect(getOwnerPrefix('radch-ai', 'radch-ai/')).toBe('radch-ai/');
		});

		it('does not partial-match owner (avoids "radch" matching "radch-ai/x")', () => {
			expect(getOwnerPrefix('radch', 'radch-ai/esk-code')).toBeNull();
		});
	});

	describe('rendering', () => {
		it('dims the owner prefix via opacity for owner/repo form', () => {
			const { getByText } = render(ProjectName, {
				displayName: 'radch-ai/esk-code',
				owner: 'radch-ai'
			});
			expect(getByText('radch-ai/')).toHaveClass('opacity-65');
			expect(getByText('esk-code')).toHaveClass('opacity-100');
		});

		it('renders displayName plainly when demoted by collision', () => {
			const { getByText, container } = render(ProjectName, {
				displayName: 'work/esk-code',
				owner: 'radch-ai'
			});
			expect(container.querySelectorAll('.opacity-65')).toHaveLength(0);
			expect(getByText('work/esk-code')).toBeInTheDocument();
		});

		it('renders displayName plainly for non-git folder', () => {
			const { getByText, container } = render(ProjectName, {
				displayName: 'my-folder',
				owner: null
			});
			expect(container.querySelectorAll('.opacity-65')).toHaveLength(0);
			expect(getByText('my-folder')).toBeInTheDocument();
		});

		it('passes through class to the outer span', () => {
			const { container } = render(ProjectName, {
				displayName: 'esk-code',
				owner: null,
				class: 'truncate'
			});
			expect(container.querySelector('span.truncate')).not.toBeNull();
		});
	});
});
