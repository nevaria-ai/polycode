import { describe, expect, it } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import ProjectName, { ownerPrefix } from './ProjectName.svelte';

describe('ProjectName', () => {
	describe('ownerPrefix', () => {
		it('returns the owner/ prefix when displayName starts with it', () => {
			expect(ownerPrefix('nevaria', 'nevaria/polycode')).toBe('nevaria/');
		});

		it('returns null when owner is null (plain folder)', () => {
			expect(ownerPrefix(null, 'polycode')).toBeNull();
		});

		it('returns null when displayName was demoted by collision', () => {
			// owner is set but displayName is now parent/folder, not owner/repo
			expect(ownerPrefix('nevaria', 'work/polycode')).toBeNull();
		});

		it('returns null when owner matches but displayName has no suffix', () => {
			// edge case: displayName is exactly "nevaria/" with empty repo
			expect(ownerPrefix('nevaria', 'nevaria/')).toBe('nevaria/');
		});

		it('does not partial-match owner (avoids "neva" matching "nevaria/x")', () => {
			expect(ownerPrefix('neva', 'nevaria/polycode')).toBeNull();
		});
	});

	describe('rendering', () => {
		it('dims the owner prefix via opacity for owner/repo form', () => {
			const { getByText } = render(ProjectName, {
				displayName: 'nevaria/polycode',
				owner: 'nevaria'
			});
			expect(getByText('nevaria/')).toHaveClass('opacity-65');
			expect(getByText('polycode')).toHaveClass('opacity-100');
			cleanup();
		});

		it('renders displayName plainly when demoted by collision', () => {
			const { getByText, container } = render(ProjectName, {
				displayName: 'work/polycode',
				owner: 'nevaria'
			});
			expect(container.querySelectorAll('.opacity-65')).toHaveLength(0);
			expect(getByText('work/polycode')).toBeInTheDocument();
			cleanup();
		});

		it('renders displayName plainly for non-git folder', () => {
			const { getByText, container } = render(ProjectName, {
				displayName: 'my-folder',
				owner: null
			});
			expect(container.querySelectorAll('.opacity-65')).toHaveLength(0);
			expect(getByText('my-folder')).toBeInTheDocument();
			cleanup();
		});

		it('passes through class to the outer span', () => {
			const { container } = render(ProjectName, {
				displayName: 'polycode',
				owner: null,
				class: 'truncate'
			});
			expect(container.querySelector('span.truncate')).not.toBeNull();
			cleanup();
		});
	});
});
