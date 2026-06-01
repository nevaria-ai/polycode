<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ChevronDown, Folder, FolderGit2, GitBranch } from '@lucide/svelte';
	import { Button } from '$components/ui/button';
	import { Checkbox } from '$components/ui/checkbox';
	import PromptPanel from '$components/PromptPanel.svelte';
	import * as DropdownMenu from '$components/ui/dropdown-menu';
	import { createSession } from '$lib/services';
	import type { PageData } from './$types';

	type HomepageHref = `/?${string}`;

	let { data } = $props<{ data: PageData }>();

	let promptText = $state('');
	let sessionAsWorktree = $state(true);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);

	let selectedProject = $derived(
		data.projectTree.find(
			(project: PageData['projectTree'][number]) => project.projectId === data.selectedProjectId
		) ?? null
	);
	let selectedWorktreeBranch = $derived(
		data.worktrees.find(
			(worktree: PageData['worktrees'][number]) => worktree.path === data.selectedWorktreePath
		)?.branch ??
			selectedProject?.defaultBranchLabel ??
			null
	);

	function isGitProject(project: PageData['projectTree'][number] | null) {
		return Boolean(project?.defaultBranchLabel || project?.worktrees.length);
	}

	function getProjectHref(projectId: string): HomepageHref {
		return `/?project=${encodeURIComponent(projectId)}`;
	}

	function getWorktreeHref(projectId: string, worktreePath: string): HomepageHref {
		return `/?project=${encodeURIComponent(projectId)}&worktree=${encodeURIComponent(worktreePath)}`;
	}

	function navigateTo(href: HomepageHref) {
		void goto(resolve(href));
	}

	async function handleSubmit() {
		if (!promptText.trim() || !data.selectedProjectId || !data.selectedWorktreePath) return;

		submitting = true;
		submitError = null;

		// TODO: When sessionAsWorktree is true, treat data.selectedWorktreePath as the
		// parent/base worktree, create a nested worktree under it before creating the
		// session, and persist the session against the new child worktree rather than
		// the selected parent. The session should be created with the child worktree's
		// worktreeId/worktreePath. Currently this is not implemented - silently ignore
		// if checkbox is true.
		if (sessionAsWorktree) {
			// TODO: Create nested worktree: createWorktree(data.selectedWorktreePath, branchName)
			// TODO: Replace parent worktreeId/worktreePath with the new child worktree values
			// For now, continue with the selected worktree as-is
		}

		let createResult;
		try {
			createResult = await createSession(data.selectedProjectId, {
				worktreeId: data.selectedWorktreeId ?? null,
				worktreePath: data.selectedWorktreePath
			});
		} catch (err: any) {
			submitError = err?.message ?? 'Failed to create session';
			submitting = false;
			return;
		}

		// Redirect to session page with initial prompt state.
		// Session page will consume initSessionFields and submit the first message.
		await goto(
			resolve(
				`/sessions/${createResult.session.id}?project=${encodeURIComponent(createResult.session.projectId)}`
			),
			{
				state: {
					initSessionFields: {
						prompt: promptText.trim()
					}
				}
			}
		);

		// Refresh all load functions so the new session appears in the sidebar immediately
		await invalidateAll();

		promptText = '';
	}
</script>

<section class="mx-3 flex h-full">
	<div
		data-testid="homepage-composer-stack"
		class="mx-auto my-auto flex w-full max-w-3xl flex-col gap-1"
	>
		<div
			data-testid="homepage-header-row"
			class="flex flex-wrap items-center justify-between gap-2"
		>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger aria-label="Select project and worktree">
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							class="h-auto items-center gap-2 px-2 py-1 text-foreground/90 hover:text-foreground/90"
						>
							{#if isGitProject(selectedProject)}
								<FolderGit2 class="size-4 shrink-0" />
							{:else}
								<Folder class="size-4 shrink-0" />
							{/if}
							<span class="text-md truncate font-medium">
								{selectedProject?.displayName ?? data.selectedProjectName ?? 'Select project'}
								{#if selectedWorktreeBranch}
									<span class="text-[10px]">:{selectedWorktreeBranch}</span>
								{/if}
							</span>
							<ChevronDown class="size-3.5 shrink-0" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>

				<DropdownMenu.Content class="w-80 p-2">
					<DropdownMenu.Label class="px-2 pb-2 text-xs text-muted-foreground">
						Select project and worktree to start agentic session in
					</DropdownMenu.Label>

					{#each data.projectTree as project (project.projectId)}
						<DropdownMenu.Group class="pt-1">
							<DropdownMenu.Item
								data-testid="composer-project-link"
								data-value={getProjectHref(project.projectId)}
								class="flex items-center gap-2"
								onclick={(e) => {
									const href = (e.currentTarget as HTMLElement).dataset.value as HomepageHref;
									if (href) navigateTo(href);
								}}
							>
								{#if isGitProject(project)}
									<FolderGit2 class="size-3.5 shrink-0 text-muted-foreground" />
								{:else}
									<Folder class="size-3.5 shrink-0 text-muted-foreground" />
								{/if}
								<span data-testid="composer-project-item" class="text-xs font-medium">
									{project.displayName ?? project.name}
								</span>
								{#if project.defaultBranchLabel}
									<span
										data-testid="composer-project-default-branch"
										class="text-[10px] text-muted-foreground"
									>
										:{project.defaultBranchLabel}
									</span>
								{/if}
							</DropdownMenu.Item>

							{#if project.worktrees.length > 0}
								{#each project.worktrees as worktree (worktree.path)}
									<DropdownMenu.Item
										data-testid="composer-worktree-link"
										data-value={getWorktreeHref(project.projectId, worktree.path)}
										class="ml-3 flex items-center gap-2 text-foreground/60"
										onclick={(e) => {
											const href = (e.currentTarget as HTMLElement).dataset.value as HomepageHref;
											if (href) navigateTo(href);
										}}
									>
										<GitBranch class="size-3 shrink-0 text-muted-foreground" />
										<span data-testid="composer-worktree-item" class="truncate text-xs">
											{worktree.branch ?? worktree.path}
										</span>
									</DropdownMenu.Item>
								{/each}
							{/if}
						</DropdownMenu.Group>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<label
				for="session-as-worktree"
				class="mr-2 flex items-center gap-2 text-xs text-muted-foreground"
			>
				<Checkbox
					id="session-as-worktree"
					data-testid="session-as-worktree-checkbox"
					bind:checked={sessionAsWorktree}
					class="data-checked:border-border data-checked:bg-muted data-checked:text-foreground dark:data-checked:bg-muted"
				/>
				<span>Session-as-worktree</span>
			</label>
		</div>

		{#if submitError}
			<p class="px-2 text-xs text-red-400">{submitError}</p>
		{/if}
		<PromptPanel
			bind:value={promptText}
			placeholder="Enter your query!"
			disabled={submitting}
			onsubmit={handleSubmit}
		/>
	</div>
</section>
