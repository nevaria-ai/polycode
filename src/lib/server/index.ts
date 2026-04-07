import { normalize } from 'node:path';
import { homedir } from 'node:os';

export const APP_DIR = normalize(`${homedir()}/.polycode`);

export * from './git';
export * from './projects';

// Ensure APP_DIR is created
import { mkdir } from 'node:fs/promises';
mkdir(APP_DIR, { recursive: true }).catch(() => {});
