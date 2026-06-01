<script lang="ts">
	import AppSidebar from './AppSidebar.svelte';
	import { SidebarProvider } from '$components/ui/sidebar';
	import type { ProjectTreeProjectInput } from '$lib/project-tree';

	let {
		projectTree = []
	}: {
		projectTree?: ProjectTreeProjectInput[];
	} = $props();
</script>

<SidebarProvider open={true}>
	<AppSidebar {projectTree} />
</SidebarProvider>
