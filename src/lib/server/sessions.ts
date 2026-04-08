import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Session } from '$lib/sessions';

const DEFAULT_SESSIONS_FILE = path.join(os.homedir(), '.polycode', 'sessions.json');

type SessionStore = {
	list(): Promise<Session[]>;
	findById(id: string): Promise<Session | undefined>;
	upsert(session: Session): Promise<Session>;
	remove(id: string): Promise<void>;
};

async function readSessions(filePath: string): Promise<Session[]> {
	try {
		return JSON.parse(await readFile(filePath, 'utf8')) as Session[];
	} catch {
		return [];
	}
}

async function writeSessions(filePath: string, sessions: Session[]): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(sessions, null, 2) + '\n', 'utf8');
}

export function createSessionStore(filePath = DEFAULT_SESSIONS_FILE): SessionStore {
	return {
		async list() {
			return readSessions(filePath);
		},
		async findById(id) {
			return (await readSessions(filePath)).find((s) => s.id === id);
		},
		async upsert(session) {
			const sessions = await readSessions(filePath);
			const existing = sessions.find((s) => s.id === session.id);

			if (existing) {
				const updated = { ...session, id: existing.id };
				const next = sessions.map((s) => (s.id === existing.id ? updated : s));
				await writeSessions(filePath, next);
				return updated;
			}

			const newSession = { ...session, id: crypto.randomUUID() };
			const next = [newSession, ...sessions];
			await writeSessions(filePath, next);
			return newSession;
		},
		async remove(id) {
			const next = (await readSessions(filePath)).filter((s) => s.id !== id);
			await writeSessions(filePath, next);
		}
	};
}
