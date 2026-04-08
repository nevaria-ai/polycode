import { createProjectStore } from './projects';
import { createSessionStore } from './sessions';
import { createCliProfileStore } from './cli-profiles';

export const projectStore = createProjectStore();
export const sessionStore = createSessionStore();
export const cliProfileStore = createCliProfileStore();
