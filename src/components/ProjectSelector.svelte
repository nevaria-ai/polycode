<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
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

	const currentProjectPath = $derived(
		page.route.id === '/projects/[projectId]' && page.params.projectId
			? decodeProjectId(page.params.projectId)
			: null
	);

	function dimColor(hex: string, opacity: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}

	async function openProject(project: StoredProject) {
		await goto(resolve(`/projects/${encodeProjectId(project.path)}`));
	}
</script>

<aside class="flex w-12 flex-col items-center gap-3 border-0 bg-(--surface-1) py-4">
	<div class="flex flex-col gap-3">
		{#each projects as project (project.path)}
			<Button
				variant="secondary"
				size="icon"
				data-slot="project-button"
				title={`Open ${project.name}`}
				aria-selected={currentProjectPath === project.path}
				class="size-8 shrink-0 rounded-md font-semibold transition-colors hover:brightness-140 aria-selected:bg-white/10 aria-selected:text-lg"
				style={`background-color: ${dimColor(project.color, 0.2)}; color: ${project.color}; --hover-bg: ${dimColor(project.color, 0.35)}`}
				onclick={() => openProject(project)}
			>
				{project.name.charAt(0).toUpperCase()}
			</Button>
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
