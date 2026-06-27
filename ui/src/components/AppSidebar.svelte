<script lang="ts">
	import * as Collapsible from '$components/ui/collapsible';
	import {
		ArrowLeftToLine,
		ChevronRight,
		FolderOpen,
		GitBranch,
		MoreHorizontal,
		Plus,
		Settings
	} from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$components/ui/button';
	import * as DropdownMenu from '$components/ui/dropdown-menu';
	import * as Sidebar from '$components/ui/sidebar';
	import * as Tooltip from '$components/ui/tooltip';
	import {
		materializeProjectTree,
		type ProjectTreeProject,
		type ProjectTreeProjectInput,
		type ProjectTreeWorktree
	} from '$lib/project-tree';
	import { APP_NAME } from '$lib/config';
	import ProjectSelectorDialog from '$components/ProjectSelectorDialog.svelte';
	import WorktreeBranchDialog from '$components/WorktreeBranchDialog.svelte';
	import DeleteWorktreeDialog from '$components/DeleteWorktreeDialog.svelte';
	import { SettingsDialog } from '$components/settings';
	import SidebarSessionList, {
		type SidebarSessionEntry
	} from '$components/SidebarSessionList.svelte';
	import { closeProject, updateProjectExpandedState } from '$lib/services';
	import { goto, invalidateAll } from '$app/navigation';

	const NOTREAL_SESSION: SidebarSessionEntry = {
		id: '__notreal__',
		title: 'No agent session yet'
	};

	function projectDisplaySessions(project: ProjectTreeProject): SidebarSessionEntry[] {
		const sessions = project.sessions ?? [];
		if (sessions.length === 0) return [NOTREAL_SESSION];
		return sessions;
	}

	function worktreeDisplaySessions(worktree: ProjectTreeWorktree): SidebarSessionEntry[] {
		if (worktree.sessions.length === 0) return [NOTREAL_SESSION];
		return worktree.sessions;
	}

	let {
		projectTree = []
	}: {
		projectTree?: ProjectTreeProjectInput[];
	} = $props();

	const sidebar = Sidebar.useSidebar();
	let tree = $state<ProjectTreeProject[]>([]);

	$effect(() => {
		tree = materializeProjectTree(
			projectTree,
			untrack(() => tree)
		);
	});

	function toggleProject(projectId: string) {
		const project = tree.find((item) => item.projectId === projectId);
		if (project) {
			project.isExpanded = !project.isExpanded;
			void updateProjectExpandedState(projectId, project.isExpanded);
		}
	}

	function toggleWorktree(projectId: string, worktreePath: string) {
		const project = tree.find((item) => item.projectId === projectId);
		const worktree = project?.worktrees.find((item) => item.path === worktreePath);
		if (worktree) worktree.isExpanded = !worktree.isExpanded;
	}

	function blurMouseClickTarget(event: MouseEvent) {
		if (event.detail > 0) {
			(event.currentTarget as HTMLElement | null)?.blur();
		}
	}

	function sessionHref(sessionId: string, projectId?: string) {
		const base = resolve('/sessions/[sessionId]', { sessionId });
		if (projectId) {
			return `${base}?project=${encodeURIComponent(projectId)}`;
		}
		return base;
	}

	function isSessionActive(sessionId: string) {
		return page.url.pathname === sessionHref(sessionId);
	}

	function isNewSessionActive() {
		return page.url.pathname === '/';
	}

	let openProjectSelector = $state(false);

	type BranchDialogMode =
		| { mode: 'create'; projectId: string }
		| { mode: 'rename'; projectId: string; worktreePath: string; oldBranch: string }
		| null;
	let branchDialogState = $state<BranchDialogMode>(null);

	type WorktreeInfo = { projectId: string; worktreePath: string; branch: string };
	let deleteWorktreeInfo = $state<WorktreeInfo | null>(null);
	let openSettings = $state(false);

	async function removeProject(projectId: string) {
		await closeProject(projectId);
		await invalidateAll();
	}

	function newProjectSession(projectId: string) {
		goto(resolve(`/?project=${encodeURIComponent(projectId)}`));
	}

	function newWorktreeSession(projectId: string, worktreePath: string) {
		goto(
			resolve(
				`/?project=${encodeURIComponent(projectId)}&worktree=${encodeURIComponent(worktreePath)}`
			)
		);
	}
</script>

<Sidebar.Root collapsible="none" class="w-full">
	<Sidebar.Header class="flex h-12 flex-row items-center justify-between">
		<h1 class="px-1 font-semibold tracking-wider">{APP_NAME}</h1>
		<Tooltip.Root delayDuration={400}>
			<Tooltip.Trigger>
				<Button
					variant="ghost"
					size="icon"
					onclick={() => sidebar.setOpen(false)}
					aria-label="Hide sidebar"
				>
					<ArrowLeftToLine class="size-5" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content class="opacity-90">Hide sidebar</Tooltip.Content>
		</Tooltip.Root>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu class="gap-1">
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={isNewSessionActive()}>
							{#snippet child({ props })}
								<a href={resolve('/')} {...props}>
									<Plus class="size-4" />
									<span>New Session</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<Sidebar.Group class="overflow-y-auto">
			<Sidebar.GroupContent>
				<Sidebar.Menu class="gap-1">
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							class="h-7 cursor-pointer text-xs text-sidebar-foreground/90"
							onclick={() => (openProjectSelector = true)}
						>
							<FolderOpen class="size-3.5" />
							<span>Open Project</span>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
					{#each tree as project (project.path)}
						<Sidebar.MenuItem class="group/menu-item text-[12px] text-sidebar-foreground/70">
							<Collapsible.Root bind:open={project.isExpanded} class="group/collapsible">
								<Sidebar.MenuButton
									class="h-auto w-full py-0 text-[12px] hover:bg-transparent active:bg-transparent"
									aria-label={`Expand ${project.name}`}
									onclick={(event) => {
										toggleProject(project.projectId);
										blurMouseClickTarget(event);
									}}
								>
									<div class="flex w-full items-center justify-between gap-1">
										<!-- Project left section: name and chevron -->
										<div
											class="project-main flex min-w-0 items-center gap-0.75 group-focus-within/menu-item:text-sidebar-accent-foreground group-hover/menu-item:text-sidebar-accent-foreground group-has-[.project-actions_[data-state=open]]/menu-item:text-sidebar-accent-foreground group-has-[.project-actions:hover]/menu-item:text-sidebar-foreground/90"
										>
											<span class="truncate">{project.displayName ?? project.name}</span>
											<ChevronRight
												class="size-3.5 shrink-0 transition-transform duration-150 group-data-[state=open]/collapsible:rotate-90"
											/>
										</div>
										<!-- Project right section: actions -->
										<div
											class="project-actions flex items-center gap-0.5 text-sidebar-foreground/90"
										>
											<DropdownMenu.Root>
												<DropdownMenu.Trigger>
													{#snippet child({ props })}
														<Button
															{...props}
															variant="ghost"
															size="icon-sm"
															class="opacity-0 transition-opacity group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 group-has-[.project-actions_[data-state=open]]/menu-item:opacity-100 hover:bg-overlay-dark!"
															aria-label="Project actions"
															onclick={(event) => event.stopPropagation()}
														>
															<MoreHorizontal class="size-3" />
														</Button>
													{/snippet}
												</DropdownMenu.Trigger>
												<DropdownMenu.Content
													class="w-48"
													side="right"
													align="start"
													sideOffset={8}
												>
													<DropdownMenu.Item
														class="text-[11px]"
														onclick={() =>
															(branchDialogState = {
																mode: 'create',
																projectId: project.projectId
															})}>Create permanent worktree</DropdownMenu.Item
													>
													<DropdownMenu.Item
														class="text-[11px] text-destructive"
														onclick={() => removeProject(project.projectId)}
														>Remove Project From workspace</DropdownMenu.Item
													>
												</DropdownMenu.Content>
											</DropdownMenu.Root>
											<Button
												variant="ghost"
												size="icon-sm"
												class="opacity-0 transition-opacity group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 group-has-[.project-actions_[data-state=open]]/menu-item:opacity-100"
												aria-label="New session"
												onclick={(event) => {
													event.stopPropagation();
													newProjectSession(project.projectId);
												}}
											>
												<Plus class="size-3.5" />
											</Button>
										</div>
									</div>
								</Sidebar.MenuButton>

								<Collapsible.Content>
									{#if project.defaultBranchLabel}
										<div
											class="project-default-branch mb-1 ml-[13px] text-[11px] text-sidebar-foreground/90"
										>
											:{project.defaultBranchLabel}
										</div>
									{/if}
									<!-- Project-level sessions (default branch or non-git) -->
									<div class="p-0">
										<SidebarSessionList
											sessions={projectDisplaySessions(project)}
											sessionHref={(id) => sessionHref(id, project.projectId)}
											{isSessionActive}
										/>
									</div>
									{#if project.worktrees.length > 0}
										<Sidebar.MenuSub class="my-2 mr-0 ml-[13px] pr-0 pl-1.5">
											{#each project.worktrees as worktree (worktree.path)}
												<Collapsible.Root
													bind:open={worktree.isExpanded}
													class="group/worktree-collapsible"
												>
													<Sidebar.MenuSubItem class="group/worktree">
														<Sidebar.MenuSubButton
															size="sm"
															class="w-full text-xs text-sidebar-foreground/90 group-has-[.worktree-actions_[data-state=open]]/worktree:bg-sidebar-accent"
															aria-label={`Expand ${worktree.branch} branch`}
															onclick={(event) => {
																toggleWorktree(project.projectId, worktree.path);
																blurMouseClickTarget(event);
															}}
														>
															<div class="flex w-full items-center justify-between gap-1">
																<!-- Worktree left section: branch and chevron -->
																<div
																	class="worktree-main flex min-w-0 items-center gap-0.75 group-focus-within/worktree:text-sidebar-accent-foreground group-hover/worktree:text-sidebar-accent-foreground group-has-[.worktree-actions_[data-state=open]]/worktree:text-sidebar-accent-foreground group-has-[.worktree-actions:focus-within]/worktree:text-sidebar-foreground group-has-[.worktree-actions:hover]/worktree:text-sidebar-foreground"
																>
																	<GitBranch class="size-3.5 shrink-0" />
																	<span class="truncate">{worktree.branch}</span>
																	<ChevronRight
																		class="size-3.5 shrink-0 opacity-0 transition-[opacity,transform] duration-150 group-focus-within/worktree:opacity-100 group-hover/worktree:opacity-100 group-has-[.worktree-actions_[data-state=open]]/worktree:opacity-100 group-data-[state=open]/worktree-collapsible:rotate-90 group-data-[state=open]/worktree-collapsible:opacity-100"
																	/>
																</div>
																<!-- Worktree right section: actions -->
																<div
																	class="worktree-actions flex items-center gap-0.5 text-sidebar-foreground"
																>
																	<DropdownMenu.Root>
																		<DropdownMenu.Trigger>
																			{#snippet child({ props })}
																				<Button
																					{...props}
																					variant="ghost"
																					size="icon-sm"
																					class="opacity-0 transition-opacity group-focus-within/worktree:opacity-100 group-hover/worktree:opacity-100 group-has-[.worktree-actions_[data-state=open]]/worktree:bg-overlay-dark! group-has-[.worktree-actions_[data-state=open]]/worktree:opacity-100 hover:bg-overlay-dark!"
																					aria-label="Worktree actions"
																					onclick={(event) => event.stopPropagation()}
																				>
																					<MoreHorizontal class="size-3.5" />
																				</Button>
																			{/snippet}
																		</DropdownMenu.Trigger>
																		<DropdownMenu.Content
																			class="w-40"
																			side="right"
																			align="start"
																			sideOffset={8}
																		>
																			<DropdownMenu.Item
																				onclick={() =>
																					(branchDialogState = {
																						mode: 'rename',
																						projectId: project.projectId,
																						worktreePath: worktree.id,
																						oldBranch: worktree.branch ?? ''
																					})}>Rename</DropdownMenu.Item
																			>
																			<DropdownMenu.Item
																				class="text-destructive"
																				onclick={() =>
																					(deleteWorktreeInfo = {
																						projectId: project.projectId,
																						worktreePath: worktree.id,
																						branch: worktree.branch ?? ''
																					})}>Delete</DropdownMenu.Item
																			>
																		</DropdownMenu.Content>
																	</DropdownMenu.Root>
																	<Button
																		variant="ghost"
																		size="icon-sm"
																		class="opacity-0 transition-opacity group-focus-within/worktree:opacity-100 group-hover/worktree:opacity-100 group-has-[.worktree-actions_[data-state=open]]/worktree:opacity-100 hover:bg-overlay-dark!"
																		aria-label="New session"
																		onclick={(event) => {
																			event.stopPropagation();
																			newWorktreeSession(project.projectId, worktree.path);
																		}}
																	>
																		<Plus class="size-3.5" />
																	</Button>
																</div>
															</div>
														</Sidebar.MenuSubButton>

														<Collapsible.Content>
															<div class="p-0">
																<SidebarSessionList
																	sessions={worktreeDisplaySessions(worktree)}
																	sessionHref={(id) => sessionHref(id, project.projectId)}
																	{isSessionActive}
																/>
															</div>
														</Collapsible.Content>
													</Sidebar.MenuSubItem>
												</Collapsible.Root>
											{/each}
										</Sidebar.MenuSub>
									{/if}
								</Collapsible.Content>
							</Collapsible.Root>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					class="sidebar-action-button h-auto"
					tooltipContent="Settings"
					onclick={() => (openSettings = true)}
				>
					<Settings class="size-4" />
					<span>Settings</span>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>

<ProjectSelectorDialog bind:open={openProjectSelector} />
<WorktreeBranchDialog bind:branchDialogState />
<DeleteWorktreeDialog bind:info={deleteWorktreeInfo} />
<SettingsDialog bind:open={openSettings} />
