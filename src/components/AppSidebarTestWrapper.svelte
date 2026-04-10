<script lang="ts">
	import AppSidebar from './AppSidebar.svelte';
	import { SidebarProvider } from '$components/ui/sidebar';
	import type { SidebarTreeProjectInput } from '$lib/sidebar-tree';

	let { sidebarProjects = [] }: { sidebarProjects?: SidebarTreeProjectInput[] } = $props();
</script>

<SidebarProvider open={true}>
	<AppSidebar {sidebarProjects} />
</SidebarProvider>
