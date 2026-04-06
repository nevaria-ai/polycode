import { describe, expect, it } from 'vitest';
import { decodeProjectId, encodeProjectId, normalizeProjectPath } from './projects';

describe('normalizeProjectPath', () => {
	it('returns an absolute normalized path without a trailing slash', () => {
		expect(normalizeProjectPath('/tmp/demo/../demo/')).toBe('/tmp/demo');
	});
});

describe('projectId helpers', () => {
	it('round-trips a normalized absolute path through base64url encoding', () => {
		const path = '/Projects/opensource-projects/polycode';
		const projectId = encodeProjectId(path);

		expect(projectId).not.toContain('=');
		expect(decodeProjectId(projectId)).toBe(path);
	});
});
