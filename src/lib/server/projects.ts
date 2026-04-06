import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { StoredProject } from '$lib/projects';
import { normalizeProjectPath, type ResolvedProjectInput } from '$lib/projects';
import { findGitTopLevel, listGitWorktrees, type ExecFileLike, type WorktreeEntry } from './git';

const DEFAULT_PROJECTS_FILE = path.join(os.homedir(), '.polycode', 'projects.json');

type ProjectStore = {
	list(): Promise<StoredProject[]>;
	upsert(project: StoredProject): Promise<StoredProject>;
	remove(projectPath: string): Promise<void>;
	findByPath(projectPath: string): Promise<StoredProject | undefined>;
};

async function readProjects(filePath: string): Promise<StoredProject[]> {
	try {
		return JSON.parse(await readFile(filePath, 'utf8')) as StoredProject[];
	} catch {
		return [];
	}
}

async function writeProjects(filePath: string, projects: StoredProject[]): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(projects, null, 2) + '\n', 'utf8');
}

export function createProjectStore(filePath = DEFAULT_PROJECTS_FILE): ProjectStore {
	return {
		async list() {
			return readProjects(filePath);
		},
		async findByPath(projectPath) {
			return (await readProjects(filePath)).find((project) => project.path === projectPath);
		},
		async upsert(project) {
			const projects = await readProjects(filePath);
			const existing = projects.find((entry) => entry.path === project.path);

			if (existing) {
				return existing;
			}

			// TODO: Support manual drag reordering when the activity panel grows beyond newest-first.
			const nextProjects = [project, ...projects];
			await writeProjects(filePath, nextProjects);
			return project;
		},
		async remove(projectPath) {
			const nextProjects = (await readProjects(filePath)).filter(
				(project) => project.path !== projectPath
			);
			await writeProjects(filePath, nextProjects);
		}
	};
}

function pickCanonicalWorktree(entries: WorktreeEntry[], fallbackPath: string): string {
	return (
		entries.find((entry) => entry.branch === 'main' || entry.branch === 'master')?.path ??
		entries.find((entry) => entry.branch === 'develop')?.path ??
		fallbackPath
	);
}

export async function resolveProjectInput(
	input: string,
	run?: ExecFileLike
): Promise<ResolvedProjectInput> {
	const normalizedInput = normalizeProjectPath(input);

	try {
		const enteredWorktreePath = await findGitTopLevel(normalizedInput, run);
		const worktrees = await listGitWorktrees(enteredWorktreePath, run);
		const canonicalPath = normalizeProjectPath(
			pickCanonicalWorktree(worktrees, enteredWorktreePath)
		);

		return {
			name: path.basename(canonicalPath),
			path: canonicalPath
		};
	} catch {
		return {
			name: path.basename(normalizedInput),
			path: normalizedInput
		};
	}
}

const PROJECT_HUES = [18, 36, 52, 145, 188, 221, 256, 292, 328];

export function generateProjectColor(): string {
	const hue = PROJECT_HUES[Math.floor(Math.random() * PROJECT_HUES.length)];
	return hslToHex(hue, 72, 52);
}

function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;

	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * color)
			.toString(16)
			.padStart(2, '0');
	};

	return `#${f(0)}${f(8)}${f(4)}`;
}
