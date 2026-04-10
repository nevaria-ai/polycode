<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import {
		ArrowLeftToLine,
		ChevronRight,
		FolderOpen,
		GitBranch,
		MoreHorizontal,
		Plus,
		Settings,
		Trash2
	} from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$components/ui/button';
	import * as DropdownMenu from '$components/ui/dropdown-menu';
	import * as Sidebar from '$components/ui/sidebar';
	import * as Tooltip from '$components/ui/tooltip';
	import {
		materializeSidebarTree,
		type SidebarTreeProject,
		type SidebarTreeProjectInput
	} from '$lib/sidebar-tree';

	let {
		sidebarProjects = []
	}: {
		sidebarProjects?: SidebarTreeProjectInput[];
	} = $props();

	const sidebar = Sidebar.useSidebar();
	let tree = $state<SidebarTreeProject[]>([]);

	$effect(() => {
		tree = materializeSidebarTree(
			sidebarProjects,
			untrack(() => tree)
		);
	});

	function toggleProject(projectId: string) {
		const project = tree.find((item) => item.projectId === projectId);
		if (project) project.isExpanded = !project.isExpanded;
	}

	function toggleWorktree(projectId: string, worktreePath: string) {
		const project = tree.find((item) => item.projectId === projectId);
		const worktree = project?.worktrees.find((item) => item.path === worktreePath);
		if (worktree) worktree.isExpanded = !worktree.isExpanded;
	}

	function sessionHref(sessionId: string) {
		return resolve('/sessions/[sessionId]', { sessionId });
	}

	function isSessionActive(sessionId: string) {
		return page.url.pathname === sessionHref(sessionId);
	}

	function isNewSessionActive() {
		return page.url.pathname === '/';
	}
</script>

<Sidebar.Root collapsible="none" class="w-full">
	<Sidebar.Header class="flex flex-row items-center justify-start">
		<Tooltip.Root delayDuration={400}>
			<Tooltip.Trigger>
				<Button
					variant="ghost"
					size="icon-lg"
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
							<Plus class="size-4" />
							<span>New Session</span>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton>
							<FolderOpen class="size-4" />
							<span>Open Project</span>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<Sidebar.Group class="overflow-y-auto">
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each tree as project (project.path)}
						<Collapsible.Root bind:open={project.isExpanded} class="group/collapsible">
							<Sidebar.MenuItem
								class="group/menu-item my-3 text-[12px] text-sidebar-foreground/70 first:mt-0"
							>
								<Sidebar.MenuButton
									class="h-auto w-full py-1 text-[12px] hover:bg-transparent"
									aria-label={`Expand ${project.name}`}
									onclick={() => toggleProject(project.projectId)}
								>
									<div class="flex w-full items-center justify-between gap-1">
										<!-- Project left section: name and chevron -->
										<div
											class="project-main group-has-[.project-actions:focus-within]/menu-item:/90 flex min-w-0 items-center gap-0.75 group-focus-within/menu-item:text-sidebar-accent-foreground group-hover/menu-item:text-sidebar-accent-foreground group-has-[.project-actions:hover]/menu-item:text-sidebar-foreground/90"
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
											<Button
												variant="ghost"
												size="icon-sm"
												class="opacity-0 transition-opacity group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100"
												aria-label="New branch"
												onclick={(event) => event.stopPropagation()}
											>
												<GitBranch class="size-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="icon-sm"
												class="opacity-0 transition-opacity group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100"
												aria-label="New session"
												onclick={(event) => event.stopPropagation()}
											>
												<Plus class="size-3.5" />
											</Button>
										</div>
									</div>
								</Sidebar.MenuButton>

								<Collapsible.Content>
									<Sidebar.MenuSub class="ml-2.5 pl-1.5 mr-0 pr-0">
										{#each project.worktrees as worktree (worktree.path)}
											<Collapsible.Root
												bind:open={worktree.isExpanded}
												class="group/worktree-collapsible"
											>
												<Sidebar.MenuSubItem class="group/worktree">
													<Sidebar.MenuSubButton
														size="sm"
														class="w-full text-xs text-sidebar-foreground/90 group-has-[.worktree-actions_[data-state=open]]/worktree:bg-sidebar-accent"
														aria-label={`Expand ${worktree.branch ?? '(detached)'} branch`}
														onclick={() => toggleWorktree(project.projectId, worktree.path)}
													>
														<div class="flex w-full items-center justify-between gap-1">
															<!-- Worktree left section: branch and chevron -->
															<div
																class="worktree-main flex min-w-0 items-center gap-0.75 group-focus-within/worktree:text-sidebar-accent-foreground group-hover/worktree:text-sidebar-accent-foreground group-has-[.worktree-actions_[data-state=open]]/worktree:text-sidebar-accent-foreground group-has-[.worktree-actions:focus-within]/worktree:text-sidebar-foreground group-has-[.worktree-actions:hover]/worktree:text-sidebar-foreground"
															>
																<GitBranch class="size-3.5 shrink-0" />
																<span class="truncate">{worktree.branch ?? '(detached)'}</span>
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
																				class="opacity-0 transition-opacity group-focus-within/worktree:opacity-100 group-hover/worktree:opacity-100 group-has-[.worktree-actions_[data-state=open]]/worktree:opacity-100 hover:bg-overlay-dark!"
																				aria-label="Worktree actions"
																				onclick={(event) => event.stopPropagation()}
																			>
																				<MoreHorizontal class="size-3" />
																			</Button>
																		{/snippet}
																	</DropdownMenu.Trigger>
																	<DropdownMenu.Content
																		class="w-40"
																		side="right"
																		align="start"
																		sideOffset={8}
																	>
																		<DropdownMenu.Item>New Session</DropdownMenu.Item>
																		<DropdownMenu.Item>Rename</DropdownMenu.Item>
																		<DropdownMenu.Item class="text-destructive"
																			>Delete</DropdownMenu.Item
																		>
																	</DropdownMenu.Content>
																</DropdownMenu.Root>
																<Button
																	variant="ghost"
																	size="icon-sm"
																	class="opacity-0 transition-opacity group-focus-within/worktree:opacity-100 group-hover/worktree:opacity-100 group-has-[.worktree-actions_[data-state=open]]/worktree:opacity-100 hover:bg-overlay-dark!"
																	aria-label="Delete worktree"
																	onclick={(event) => event.stopPropagation()}
																>
																	<Trash2 class="size-3" />
																</Button>
															</div>
														</div>
													</Sidebar.MenuSubButton>

													<Collapsible.Content>
														<div class="mt-1">
															{#each worktree.sessions as session (session.id)}
																<Sidebar.MenuSubButton
																	href={sessionHref(session.id)}
																	isActive={isSessionActive(session.id)}
																	class="sidebar-session-link ml-5 h-auto items-start gap-1"
																>
																	<span class="sidebar-session-status" aria-hidden="true">•</span>
																	<span class="line-clamp-2"
																		>{session.title ?? 'Untitled session'}</span
																	>
																</Sidebar.MenuSubButton>
															{/each}
														</div>
													</Collapsible.Content>
												</Sidebar.MenuSubItem>
											</Collapsible.Root>
										{/each}
									</Sidebar.MenuSub>
								</Collapsible.Content>
							</Sidebar.MenuItem>
						</Collapsible.Root>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton class="sidebar-action-button h-auto" tooltipContent="Settings">
					<Settings class="size-4" />
					<span>Settings</span>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
