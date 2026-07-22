<script lang="ts">
	import AppSidebar from './AppSidebar.svelte';
	import { SidebarProvider } from '$components/ui/sidebar';
	import type { SidebarProjectInput } from '$lib/project-tree';

	let {
		projectTree = []
	}: {
		projectTree?: SidebarProjectInput[];
	} = $props();
</script>

<SidebarProvider open={true}>
	<AppSidebar {projectTree} />
</SidebarProvider>
