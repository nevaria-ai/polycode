import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSessionStore } from './sessions';

describe('createSessionStore', () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(path.join(os.tmpdir(), 'polycode-sessions-'));
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it('returns empty list when no sessions exist', async () => {
		const store = createSessionStore(path.join(root, 'sessions.json'));
		const sessions = await store.list();

		expect(sessions).toHaveLength(0);
	});

	it('upsert creates new session with auto-generated ID', async () => {
		const store = createSessionStore(path.join(root, 'sessions.json'));

		const session = await store.upsert({
			id: '',
			cliProfileId: 'profile-1',
			projectId: 'test-project',
			worktreePath: '/test/worktree',
			title: null,
			status: 'active',
			createdAt: new Date().toISOString(),
			lastActiveAt: new Date().toISOString()
		});

		expect(session.id).toBeDefined();
		expect(typeof session.id).toBe('string');
		expect(session.cliProfileId).toBe('profile-1');

		const sessions = await store.list();
		expect(sessions).toHaveLength(1);
	});

	it('upsert updates existing session by ID', async () => {
		const store = createSessionStore(path.join(root, 'sessions.json'));

		const created = await store.upsert({
			id: '',
			cliProfileId: 'profile-1',
			projectId: 'test-project',
			worktreePath: '/test/worktree',
			title: null,
			status: 'active',
			createdAt: new Date().toISOString(),
			lastActiveAt: new Date().toISOString()
		});

		const updated = await store.upsert({
			...created,
			title: 'My Session',
			status: 'ended'
		});

		expect(updated.id).toBe(created.id);
		expect(updated.title).toBe('My Session');
		expect(updated.status).toBe('ended');

		const sessions = await store.list();
		expect(sessions).toHaveLength(1);
		expect(sessions[0].title).toBe('My Session');
	});

	it('removes session by ID', async () => {
		const store = createSessionStore(path.join(root, 'sessions.json'));

		const created = await store.upsert({
			id: '',
			cliProfileId: 'profile-1',
			projectId: 'test-project',
			worktreePath: '/test/worktree',
			title: null,
			status: 'active',
			createdAt: new Date().toISOString(),
			lastActiveAt: new Date().toISOString()
		});

		await store.remove(created.id);

		const sessions = await store.list();
		expect(sessions).toHaveLength(0);
	});

	it('finds session by ID', async () => {
		const store = createSessionStore(path.join(root, 'sessions.json'));

		const created = await store.upsert({
			id: '',
			cliProfileId: 'profile-1',
			projectId: 'test-project',
			worktreePath: '/test/worktree',
			title: null,
			status: 'active',
			createdAt: new Date().toISOString(),
			lastActiveAt: new Date().toISOString()
		});

		const found = await store.findById(created.id);
		expect(found).toBeDefined();
		expect(found?.id).toBe(created.id);

		const notFound = await store.findById('non-existent-id');
		expect(notFound).toBeUndefined();
	});
});
