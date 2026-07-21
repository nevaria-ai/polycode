export { api } from './api';

export { getProjects, createProject, closeProject, updateProjectExpandedState } from './projects';
export {
	createSession,
	getSession,
	deleteSession,
	updateSessionTitle,
	archiveSession
} from './sessions';
export { createWorktree, renameWorktreeBranch, deleteWorktree } from './worktrees';
export { sendMessage } from './messages';
export { getDirectories } from './directories';

export type {
	ProjectTree,
	Session,
	MessageView,
	PartViewItem,
	PinnedContextViewItem,
	ProviderRunViewItem,
	SessionViewData,
	DirectoryResponse,
	SessionMetadata,
	WorktreeWithSessions,
	CreateSessionApiInput,
	RenameSessionApiInput,
	SubmitMessageApiInput
} from '$lib/types/api';
