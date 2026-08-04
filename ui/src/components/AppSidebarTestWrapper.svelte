<script lang="ts">
	import AppSidebar from './AppSidebar.svelte';
	import { SidebarProvider } from '$components/ui/sidebar';
	import type { ProjectDto } from '$lib/command';

	let {
		projects = []
	}: {
		projects?: ProjectDto[];
	} = $props();
</script>

<SidebarProvider open={true}>
	<AppSidebar {projects} />
</SidebarProvider>
