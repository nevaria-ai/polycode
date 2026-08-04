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
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$components/ui/button';
	import * as DropdownMenu from '$components/ui/dropdown-menu';
	import * as Sidebar from '$components/ui/sidebar';
	import * as Tooltip from '$components/ui/tooltip';
	import { commands, unwrapCommand, type ProjectDto, type WorktreeDto } from '$lib/command';
	import { getLinkedWorktrees, getUnlinkedWorktree } from '$lib/project';
	import { APP_NAME } from '$lib/constants';
	import ProjectSelectorDialog from '$components/ProjectSelectorDialog.svelte';
	import ProjectName from '$components/ProjectName.svelte';
	import WorktreeBranchDialog from '$components/WorktreeBranchDialog.svelte';
	import DeleteWorktreeDialog from '$components/DeleteWorktreeDialog.svelte';
	import { SettingsDialog } from '$components/settings';
	import SidebarSessionList, {
		type SidebarSessionEntry
	} from '$components/SidebarSessionList.svelte';
	import { goto, invalidate } from '$app/navigation';
	import { worktreeExpanded } from '$lib/worktree-expanded.svelte';

	const NOTREAL_SESSION: SidebarSessionEntry = {
		id: '__notreal__',
		title: 'No agent session yet'
	};

	function getDisplaySessions(sessions: WorktreeDto['sessions']): SidebarSessionEntry[] {
		if (sessions.length === 0) return [NOTREAL_SESSION];
		return sessions;
	}

	let {
		projects = []
	}: {
		projects?: ProjectDto[];
	} = $props();

	const sidebar = Sidebar.useSidebar();

	let openProjectSelector = $state(false);

	type BranchDialogMode =
		| { mode: 'create'; projectId: string }
		| { mode: 'rename'; projectId: string; worktreeId: string }
		| null;
	let branchDialogState = $state<BranchDialogMode>(null);

	type WorktreeDeleteTarget = { projectId: string; worktreeId: string; branch: string };
	let deleteWorktreeInfo = $state<WorktreeDeleteTarget | null>(null);
	let openSettings = $state(false);
	let actionError = $state<string | null>(null);

	async function toggleWorktreeExpanded(projectId: string, worktreeId: string) {
		const worktree = projects
			.find((item) => item.id === projectId)
			?.worktrees.find((item) => item.id === worktreeId);
		if (!worktree) return;

		const next = !worktreeExpanded.get(worktree);
		worktreeExpanded.set(worktreeId, next);
		actionError = null;
		try {
			await commands.updateWorktreeExpandedState(projectId, worktreeId, next).then(unwrapCommand);
		} catch (e) {
			worktreeExpanded.set(worktreeId, !next);
			actionError = e instanceof Error ? e.message : 'Failed to update worktree';
		}
	}

	async function removeProject(projectId: string) {
		actionError = null;
		try {
			await commands.closeProject(projectId).then(unwrapCommand);
			await invalidate('project:tree');
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to close project';
		}
	}

	function blurMouseClickTarget(event: MouseEvent) {
		if (event.detail > 0) {
			(event.currentTarget as HTMLElement | null)?.blur();
		}
	}

	function isNewSessionActive() {
		return page.url.pathname === '/';
	}

	function selectWorkspaceForNewSession(worktreeId: string) {
		goto(resolve(`/?workspace=${worktreeId}`));
	}
</script>

<Sidebar.Root collapsible="none" class="w-full">
	<Sidebar.Header class="flex h-12 flex-row items-center justify-between">
		<h1 data-testid="sidebar-app-name" class="px-1 font-semibold tracking-wider">
			{APP_NAME}
		</h1>
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
					{#each projects as project (project.path)}
						{@const unlinkedWorktree = getUnlinkedWorktree(project)}
						{@const linkedWorktrees = getLinkedWorktrees(project)}
						<Sidebar.MenuItem class="group/menu-item text-[12px] text-sidebar-foreground/70">
							<Collapsible.Root
								open={unlinkedWorktree ? worktreeExpanded.get(unlinkedWorktree) : false}
								class="group/collapsible"
							>
								<Sidebar.MenuButton
									class="h-auto w-full py-0 text-[12px] hover:bg-transparent active:bg-transparent"
									aria-label={`Expand ${project.displayName}`}
									onclick={(event) => {
										if (unlinkedWorktree) {
											toggleWorktreeExpanded(project.id, unlinkedWorktree.id);
										}
										blurMouseClickTarget(event);
									}}
								>
									<div class="flex w-full items-center justify-between gap-1">
										<!-- Project left section: name and chevron -->
										<div
											class="project-main flex min-w-0 items-center gap-0.75 group-focus-within/menu-item:text-sidebar-accent-foreground group-hover/menu-item:text-sidebar-accent-foreground group-has-[.project-actions_[data-state=open]]/menu-item:text-sidebar-accent-foreground group-has-[.project-actions:hover]/menu-item:text-sidebar-foreground/90"
										>
											<ProjectName
												displayName={project.displayName}
												owner={project.owner}
												class="truncate"
											/>
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
																projectId: project.id
															})}>Create permanent worktree</DropdownMenu.Item
													>
													<DropdownMenu.Item
														class="text-[11px] text-destructive"
														onclick={() => removeProject(project.id)}
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
													if (unlinkedWorktree) {
														selectWorkspaceForNewSession(unlinkedWorktree.id);
													}
												}}
											>
												<Plus class="size-3.5" />
											</Button>
										</div>
									</div>
								</Sidebar.MenuButton>

								<Collapsible.Content>
									{#if unlinkedWorktree?.branch}
										<div
											class="project-default-branch mb-1 ml-[13px] text-[11px] text-sidebar-foreground/90"
										>
											:{unlinkedWorktree.branch}
										</div>
									{/if}
									<!-- unlinkedWorktree sessions (default branch or non-git) -->
									<div class="p-0">
										<SidebarSessionList
											sessions={getDisplaySessions(unlinkedWorktree?.sessions ?? [])}
										/>
									</div>
									{#if linkedWorktrees.length > 0}
										<Sidebar.MenuSub class="my-2 mr-0 ml-[13px] pr-0 pl-1.5">
											{#each linkedWorktrees as worktree (worktree.id)}
												<Collapsible.Root
													open={worktreeExpanded.get(worktree)}
													class="group/worktree-collapsible"
												>
													<Sidebar.MenuSubItem class="group/worktree">
														<Sidebar.MenuSubButton
															size="sm"
															class="w-full text-xs text-sidebar-foreground/90 group-has-[.worktree-actions_[data-state=open]]/worktree:bg-sidebar-accent"
															aria-label={`Expand ${worktree.branch} branch`}
															onclick={(event) => {
																toggleWorktreeExpanded(project.id, worktree.id);
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
																						projectId: project.id,
																						worktreeId: worktree.id
																					})}>Rename branch</DropdownMenu.Item
																			>
																			<DropdownMenu.Item
																				class="text-destructive"
																				onclick={() =>
																					(deleteWorktreeInfo = {
																						projectId: project.id,
																						worktreeId: worktree.id,
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
																			selectWorkspaceForNewSession(worktree.id);
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
																	sessions={getDisplaySessions(worktree.sessions)}
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

	{#if actionError}
		<p class="px-3 pb-2 text-xs break-words text-destructive">{actionError}</p>
	{/if}

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
