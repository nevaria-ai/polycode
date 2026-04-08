import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { CliProfile } from '$lib/cli-profiles';

const DEFAULT_CLI_PROFILES_FILE = path.join(os.homedir(), '.polycode', 'cli-profiles.json');

export const DEFAULT_CLI_PROFILES: Omit<CliProfile, 'id'>[] = [
	{
		name: 'Claude',
		command: 'claude',
		args: [],
		env: {},
		predefined: true
	}
];

type CliProfileStore = {
	list(): Promise<CliProfile[]>;
	upsert(profile: CliProfile): Promise<CliProfile>;
	remove(id: string): Promise<void>;
	findById(id: string): Promise<CliProfile | undefined>;
};

async function readCliProfiles(filePath: string): Promise<CliProfile[]> {
	try {
		return JSON.parse(await readFile(filePath, 'utf8')) as CliProfile[];
	} catch {
		return [];
	}
}

async function writeCliProfiles(filePath: string, profiles: CliProfile[]): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(profiles, null, 2) + '\n', 'utf8');
}

async function ensureInitialized(filePath: string): Promise<void> {
	try {
		await readFile(filePath, 'utf8');
	} catch {
		// File doesn't exist, seed defaults
		const profiles = DEFAULT_CLI_PROFILES.map((profile) => ({
			...profile,
			id: crypto.randomUUID()
		}));
		await writeCliProfiles(filePath, profiles);
	}
}

export function createCliProfileStore(filePath = DEFAULT_CLI_PROFILES_FILE): CliProfileStore {
	return {
		async list() {
			await ensureInitialized(filePath);
			return readCliProfiles(filePath);
		},
		async findById(id) {
			return (await readCliProfiles(filePath)).find((profile) => profile.id === id);
		},
		async upsert(profile) {
			await ensureInitialized(filePath);
			const profiles = await readCliProfiles(filePath);

			const existing = profiles.find((entry) => entry.id === profile.id);

			if (existing) {
				const updated = { ...profile, id: existing.id };
				const nextProfiles = profiles.map((entry) => (entry.id === existing.id ? updated : entry));
				await writeCliProfiles(filePath, nextProfiles);
				return updated;
			}

			const newProfile = { ...profile, id: crypto.randomUUID() };
			const nextProfiles = [newProfile, ...profiles];
			await writeCliProfiles(filePath, nextProfiles);
			return newProfile;
		},
		async remove(id) {
			const nextProfiles = (await readCliProfiles(filePath)).filter((profile) => profile.id !== id);
			await writeCliProfiles(filePath, nextProfiles);
		}
	};
}
