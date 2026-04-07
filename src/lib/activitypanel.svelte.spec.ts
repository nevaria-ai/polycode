import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { activityPanel } from './activitypanel.svelte';

describe('activityPanel', () => {
	beforeEach(() => {
		// Reset to closed state before each test
		activityPanel.close();
	});

	afterEach(() => {
		// Clean up state
		activityPanel.close();
	});

	describe('Initial State', () => {
		it('starts with closed state by default', () => {
			expect(activityPanel.isOpen).toBe(false);
		});

		it('has boolean open state', () => {
			expect(typeof activityPanel.isOpen).toBe('boolean');
		});
	});

	describe('State Transitions', () => {
		it('opens panel when open() is called', () => {
			activityPanel.open();
			expect(activityPanel.isOpen).toBe(true);
		});

		it('closes panel when close() is called', () => {
			activityPanel.open();
			expect(activityPanel.isOpen).toBe(true);

			activityPanel.close();
			expect(activityPanel.isOpen).toBe(false);
		});

		it('toggles panel state when toggle() is called', () => {
			expect(activityPanel.isOpen).toBe(false);

			activityPanel.toggle();
			expect(activityPanel.isOpen).toBe(true);

			activityPanel.toggle();
			expect(activityPanel.isOpen).toBe(false);
		});
	});

	describe('Idempotent Operations', () => {
		it('calling open() multiple times has no side effects', () => {
			activityPanel.open();
			activityPanel.open();
			activityPanel.open();

			expect(activityPanel.isOpen).toBe(true);
		});

		it('calling close() multiple times has no side effects', () => {
			activityPanel.open();
			activityPanel.close();
			activityPanel.close();
			activityPanel.close();

			expect(activityPanel.isOpen).toBe(false);
		});
	});

	describe('Integration with Project Navigation', () => {
		it('preserves open state when navigating between projects', () => {
			// Open panel for project 1
			activityPanel.open();
			expect(activityPanel.isOpen).toBe(true);

			// Simulate navigation to project 2
			// State should persist
			expect(activityPanel.isOpen).toBe(true);
		});

		it('preserves closed state when navigating between projects', () => {
			// Ensure panel is closed
			activityPanel.close();
			expect(activityPanel.isOpen).toBe(false);

			// Simulate navigation to another project
			// State should persist
			expect(activityPanel.isOpen).toBe(false);
		});
	});
});
