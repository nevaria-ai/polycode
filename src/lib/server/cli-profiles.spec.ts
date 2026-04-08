import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCliProfileStore, DEFAULT_CLI_PROFILES } from './cli-profiles';

describe('createCliProfileStore', () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(path.join(os.tmpdir(), 'polycode-cli-profiles-'));
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it('seeds defaults on first list', async () => {
		const store = createCliProfileStore(path.join(root, 'cli-profiles.json'));
		const profiles = await store.list();

		expect(profiles).toHaveLength(1);
		expect(profiles[0]).toMatchObject(DEFAULT_CLI_PROFILES[0]);
		expect(profiles[0].id).toBeDefined();
		expect(typeof profiles[0].id).toBe('string');
	});

	it('upsert adds new profile', async () => {
		const store = createCliProfileStore(path.join(root, 'cli-profiles.json'));

		const newProfile = await store.upsert({
			id: 'ignored',
			name: 'ChatGPT',
			command: 'chatgpt',
			args: ['--model', 'gpt-4'],
			env: { OPENAI_API_KEY: 'sk-test' },
			predefined: false
		});

		expect(newProfile.id).toBeDefined();
		expect(newProfile.id).not.toBe('ignored');
		expect(newProfile.name).toBe('ChatGPT');

		const profiles = await store.list();
		expect(profiles).toHaveLength(2); // Default Claude + new profile
		expect(profiles[0].id).toBe(newProfile.id);
	});

	it('upsert updates existing profile by id', async () => {
		const store = createCliProfileStore(path.join(root, 'cli-profiles.json'));
		const profiles = await store.list();
		const existingId = profiles[0].id;

		const updated = await store.upsert({
			id: existingId,
			name: 'Claude Updated',
			command: 'claude',
			args: ['--version', '3'],
			env: {},
			predefined: true
		});

		expect(updated.id).toBe(existingId);
		expect(updated.name).toBe('Claude Updated');

		const currentProfiles = await store.list();
		expect(currentProfiles).toHaveLength(1);
		expect(currentProfiles[0].name).toBe('Claude Updated');
		expect(currentProfiles[0].args).toEqual(['--version', '3']);
	});

	it('removes profile by id', async () => {
		const store = createCliProfileStore(path.join(root, 'cli-profiles.json'));
		const profiles = await store.list();
		const existingId = profiles[0].id;

		await store.remove(existingId);

		const currentProfiles = await store.list();
		expect(currentProfiles).toHaveLength(0);
	});

	it('finds profile by id', async () => {
		const store = createCliProfileStore(path.join(root, 'cli-profiles.json'));
		const profiles = await store.list();
		const existingId = profiles[0].id;

		const found = await store.findById(existingId);
		expect(found).toBeDefined();
		expect(found?.id).toBe(existingId);
		expect(found?.name).toBe('Claude');

		const notFound = await store.findById('non-existent-id');
		expect(notFound).toBeUndefined();
	});
});
