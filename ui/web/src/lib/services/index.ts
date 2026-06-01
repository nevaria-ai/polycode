export { api } from './api';

export { getProjects, createProject, closeProject, updateProjectExpandedState } from './projects';
export {
	listAllSessions,
	listSessions,
	createSession,
	getSession,
	deleteSession,
	updateSessionTitle,
	archiveSession
} from './sessions';
export { listWorktrees, createWorktree, renameWorktree, deleteWorktree } from './worktrees';
export { listMessages, sendMessage } from './messages';
export { getDirectories } from './directories';

export type {
	Project,
	Session,
	Worktree,
	MessageView,
	PartViewItem,
	PinnedContextViewItem,
	ProviderRunViewItem,
	SessionViewData,
	DirectoryResponse,
	SidebarProject,
	CreateSessionApiInput,
	RenameSessionApiInput,
	ArchiveSessionApiInput,
	SubmitMessageApiInput
} from '$lib/types/api';
