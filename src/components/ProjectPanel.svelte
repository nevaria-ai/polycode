<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$components/ui/button';
	import { Plus } from '@lucide/svelte';
	import ProjectSelectorDialog from './ProjectSelectorDialog.svelte';
	import { decodeProjectId, encodeProjectId, type StoredProject } from '$lib/projects';

	let {
		projects = []
	}: {
		projects?: StoredProject[];
	} = $props();

	let dialogOpen = $state(false);

	async function openProject(project: StoredProject) {
		const projectId = encodeProjectId(project.path);
		await goto(resolve('/projects/[projectId]', { projectId }), { keepFocus: true });
	}

	function dimColor(hex: string, opacity: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}
</script>

<aside class="flex w-13 flex-col items-center gap-3 border-0 py-4">
	<div class="flex flex-col gap-3">
		{#each projects as project (project.path)}
			{#if page.route.id === '/projects/[projectId]' && page.params.projectId != null && decodeProjectId(page.params.projectId) === project.path}
				<Button
					variant="secondary"
					size="icon"
					data-slot="project-button"
					title={`Currently viewing ${project.name}`}
					aria-selected={true}
					class="text-md brightness:110 size-8 shrink-0 rounded-md font-semibold transition-colors hover:brightness-140 aria-selected:ring-2 aria-selected:ring-white/70"
					style="background-color: {dimColor(project.color, 0.2)}; color: {project.color}"
				>
					{project.name.charAt(0).toUpperCase()}
				</Button>
			{:else}
				<Button
					variant="secondary"
					size="icon"
					data-slot="project-button"
					title={`Open ${project.name}`}
					aria-selected={false}
					class="text-md size-8 shrink-0 rounded-md font-semibold transition-colors hover:brightness-140 aria-selected:ring-2 aria-selected:ring-white/70"
					style="background-color: {dimColor(project.color, 0.2)}; color: {project.color}"
					onclick={() => openProject(project)}
				>
					{project.name.charAt(0).toUpperCase()}
				</Button>
			{/if}
		{/each}
	</div>

	<Button
		variant="ghost"
		size="icon"
		class="size-8 hover:bg-white/15!"
		title="Open project"
		onclick={() => (dialogOpen = true)}
	>
		<Plus class="size-5" />
	</Button>

	<ProjectSelectorDialog bind:open={dialogOpen} />
</aside>
