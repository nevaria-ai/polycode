<script lang="ts">
	import { page } from '$app/state';
	import { Menu } from '@lucide/svelte';
	import { Button } from '$components/ui/button';
	import { activityPanel } from '$lib/activitypanel.svelte';

	// Detect if we're on a project route by checking URL pathname
	const isProjectRoute = $derived(/^\/projects\/[^/]+/.test(page.url.pathname));
</script>

<header class="flex h-12 items-center justify-between border-0 px-6 pl-12">
	<!-- Left slot: Activity panel trigger (project routes) or Brand (non-project routes) -->
	{#if isProjectRoute}
		<div class="flex items-center gap-3">
			<Button
				variant="ghost"
				size="icon"
				class="size-8"
				aria-label="Toggle activity panel"
				onclick={() => activityPanel.toggle()}
			>
				<Menu class="size-4" />
			</Button>
		</div>
	{:else}
		<div class="flex items-center gap-3">
			<div class="flex gap-[3.5px]">
				<div class="size-2 rounded-full bg-(--accent-claude)"></div>
				<div class="size-2 rounded-full bg-(--accent-gemini)"></div>
			</div>
			<span class="text-sm font-semibold tracking-[0.22em] uppercase">polycode</span>
		</div>
	{/if}

	<!-- Center slot: Brand (project routes) or Context (non-project routes) -->
	{#if isProjectRoute}
		<div class="flex items-center gap-3">
			<div class="flex gap-[3.5px]">
				<div class="size-2 rounded-full bg-(--accent-claude)"></div>
				<div class="size-2 rounded-full bg-(--accent-gemini)"></div>
			</div>
			<span class="text-sm font-semibold tracking-[0.22em] uppercase">polycode</span>
		</div>
	{:else}
		<div class="text-sm text-zinc-400">No session selected</div>
	{/if}

	<!-- Right slot: Actions (same for both routes) -->
	<div class="text-sm text-zinc-500">Actions later</div>
</header>
