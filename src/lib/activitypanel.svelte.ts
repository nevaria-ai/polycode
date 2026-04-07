import { browser } from '$app/environment';

const STORAGE_KEY = 'activity-panel-open';

// Load initial state from localStorage
const initialState = browser ? localStorage.getItem(STORAGE_KEY) === 'true' : false;

// Activity panel state for project routes
let isOpen = $state(initialState);

export const activityPanel = {
	get isOpen() {
		return isOpen;
	},
	open: () => {
		isOpen = true;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, 'true');
		}
	},
	close: () => {
		isOpen = false;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, 'false');
		}
	},
	toggle: () => {
		isOpen = !isOpen;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, isOpen ? 'true' : 'false');
		}
	}
};
