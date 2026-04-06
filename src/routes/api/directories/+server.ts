import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');

	if (!query || query.length < 1) {
		return json([]);
	}

	const suggestions: string[] = [];

	// Check if query starts with ~ and remember for unexpanding later
	const startsWithTilde = query.startsWith('~');

	// Expand ~ to home directory for searching
	const home = process.env.HOME || '';
	const expandedQuery = startsWithTilde ? home + query.slice(1) : query;

	// Check if query ends with / (show all in directory)
	const endsWithSlash = query.endsWith('/');

	let parentDir: string;
	let searchTerm: string;

	if (endsWithSlash) {
		// Query ends with /, so we want to show contents of that directory
		// / means search root, /Projects/ means search /Projects
		if (expandedQuery === '/') {
			parentDir = '/';
		} else {
			// Remove trailing slash to get the directory path
			parentDir = expandedQuery.slice(0, -1);
		}
		searchTerm = ''; // Show all directories
	} else {
		// Query doesn't end with /, search parent for matching directories
		parentDir = dirname(expandedQuery);
		searchTerm = basename(expandedQuery).toLowerCase();
	}

	// Only search if parent directory exists
	if (parentDir && existsSync(parentDir)) {
		try {
			const entries = readdirSync(parentDir, { withFileTypes: true });

			for (const entry of entries) {
				if (!entry.isDirectory()) continue;

				const lowerName = entry.name.toLowerCase();

				// If ends with /, show all. Otherwise, only match if starts with search term
				if (endsWithSlash || lowerName.startsWith(searchTerm)) {
					const fullPath = join(parentDir, entry.name);

					// For non-ending-slash queries, only add if starts with the expanded query
					if (!endsWithSlash && !fullPath.toLowerCase().startsWith(expandedQuery.toLowerCase())) {
						continue;
					}

					// Unexpand home directory back to ~ if query started with ~
					const displayPath =
						startsWithTilde && fullPath.startsWith(home)
							? '~' + fullPath.slice(home.length)
							: fullPath;

					suggestions.push(displayPath);
				}

				// Limit to 10 suggestions
				if (suggestions.length >= 10) break;
			}
		} catch {
			// Can't read directory, return empty
		}
	}

	// Sort: exact match first, then alphabetically
	suggestions.sort((a, b) => {
		const aLower = a.toLowerCase();
		const bLower = b.toLowerCase();

		// Exact match first (compare display paths)
		const queryLower = query.toLowerCase();
		if (aLower === queryLower) return -1;
		if (bLower === queryLower) return 1;

		// Alphabetical
		return a.localeCompare(b);
	});

	return json(suggestions.slice(0, 10));
};
