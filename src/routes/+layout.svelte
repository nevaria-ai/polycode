<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	import AppHeader from '$components/AppHeader.svelte';
	import ProjectPanel from '$components/ProjectPanel.svelte';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex h-svh flex-col overflow-hidden bg-(--surface-1)">
	<AppHeader />
	<div class="flex min-h-0 flex-1">
		<ProjectPanel projects={data.projects} />
		<main class="w-full overflow-y-auto rounded-tl-xl bg-(--surface-0)">
			{@render children()}
		</main>
	</div>
</div>
