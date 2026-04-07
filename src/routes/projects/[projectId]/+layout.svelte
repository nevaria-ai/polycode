<script lang="ts">
	import type { LayoutData } from './$types';
	import WorkspaceView from '$components/WorkspaceView.svelte';
	import { activityPanel } from '$lib/activitypanel.svelte';
	import { buttonVariants } from '$components/ui/button';
	import * as DropdownMenu from '$components/ui/dropdown-menu';
	import { MoreHorizontal } from '@lucide/svelte';
	import { page } from '$app/state';

	let { data, children } = $props<{
		data: LayoutData;
		children: import('svelte').Snippet;
	}>();

	const project = $derived(data.project);
	const projectPath = $derived(project?.path ?? '');
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
						<DropdownMenu.Item>Create new worktree</DropdownMenu.Item>
						<DropdownMenu.Item>
							<form method="POST" action="/projects/?/close" class="w-full">
								<input type="hidden" name="projectId" value={page.params.projectId} />
								<button type="submit" class="w-full text-left">Close Project</button>
							</form>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>

			<!-- Activity Panel Content Area -->
			<div class="flex-1 overflow-y-auto p-4">
				<WorkspaceView worktrees={data.worktrees} {projectPath} />
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

<svelte:window
	on:keydown={(e) => {
		if (e.key === 'Escape' && activityPanel.isOpen) {
			activityPanel.close();
		}
	}}
/>
