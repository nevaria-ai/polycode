<script lang="ts">
	import type { LayoutData } from './$types';
	import WorkspaceView from '$components/WorkspaceView.svelte';
	import { activityPanel } from '$lib/activitypanel.svelte';
	import { Button } from '$components/ui/button';
	import { buttonVariants } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import * as DropdownMenu from '$components/ui/dropdown-menu';
	import * as Dialog from '$components/ui/dialog';
	import { MoreHorizontal } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { openNewSession } from '$lib/session';

	let { data, children } = $props<{
		data: LayoutData;
		children: import('svelte').Snippet;
	}>();

	const project = $derived(data.project);
	const projectPath = $derived(project?.path ?? '');

	// Create worktree dialog state
	let createDialogOpen = $state(false);
	let branchName = $state('');
	let createError = $state('');

	// Clear dialog state on close
	$effect(() => {
		if (!createDialogOpen) {
			branchName = '';
			createError = '';
		}
	});
</script>

{#if project}
	<div class="flex h-full">
		<!-- Project Activity Panel -->
		<aside
			class="flex flex-col transition-all duration-200 {activityPanel.isOpen
				? 'w-72 border-r bg-white/3'
				: 'w-0 overflow-hidden'}"
		>
			<!-- Panel Header -->
			<div class="flex items-center justify-between border-b border-white/8 p-4">
				<div class="flex items-center gap-2">
					<div class="size-3 rounded-full" style="background-color: {project.color};"></div>
					<h2 class="text-sm font-medium text-zinc-200">{project.name}</h2>
				</div>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class={buttonVariants({ variant: 'ghost', size: 'icon' })}
						aria-label="Project menu"
						style="padding: 0.25rem; height: auto; width: auto;"
					>
						<MoreHorizontal class="size-3.5" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content>
						<DropdownMenu.Item>
							<button onclick={() => (createDialogOpen = true)} class="w-full text-left">
								Create new worktree
							</button>
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							<form method="POST" action="/projects/?/close" class="w-full">
								<input type="hidden" name="projectId" value={$page.params.projectId} />
								<button type="submit" class="w-full text-left">Close Project</button>
							</form>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>

			<!-- Activity Panel Content Area -->
			<div class="flex-1 overflow-y-auto p-4">
				<WorkspaceView
					worktrees={data.worktrees}
					{projectPath}
					projectId={$page.params.projectId!}
				/>
			</div>
		</aside>

		<!-- Main Content Area -->
		<main class="flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
{:else}
	<!-- Project not found state -->
	{@render children()}
{/if}

<!-- Create Worktree Dialog -->
<Dialog.Root bind:open={createDialogOpen}>
	<Dialog.Content class="overflow-hidden sm:max-w-md">
		<form
			method="POST"
			action="?/createWorktree"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						const data = result.data as Record<string, string | undefined>;
						if (data?.error) {
							createError = data.error;
						} else {
							await update({ reset: false });
							createDialogOpen = false;
							openNewSession($page.params.projectId!);
						}
					}
				};
			}}
			class="grid gap-4"
		>
			<Dialog.Header>
				<Dialog.Title>Create New Worktree</Dialog.Title>
				<Dialog.Description>Enter the branch name for the new worktree</Dialog.Description>
			</Dialog.Header>

			<div class="py-4">
				<Input
					bind:value={branchName}
					name="branchName"
					placeholder="Branch name (e.g., feature/new-feature)"
					required
				/>
				{#if createError}
					<p class="mt-2 text-sm break-words text-red-400">{createError}</p>
				{/if}
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createDialogOpen = false)}>
					Cancel
				</Button>
				<Button type="submit" disabled={!branchName.trim()}>Create</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && activityPanel.isOpen) {
			activityPanel.close();
		}
	}}
/>
