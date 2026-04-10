<script lang="ts">
	import { browser } from '$app/environment';
	import { ArrowRightFromLine } from '@lucide/svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Button } from '$components/ui/button';
	import { SidebarProvider } from '$components/ui/sidebar';
	import { SIDEBAR_COOKIE_NAME } from '$components/ui/sidebar/constants';
	import * as Resizable from '$components/ui/resizable';
	import * as Tooltip from '$components/ui/tooltip';
	import type { Pane } from 'paneforge';
	import AppSidebar from '$components/AppSidebar.svelte';

	let { children, data } = $props();
	const initialSidebarOpen = data.initialSidebarOpen;
	let sidebarOpen = $state(initialSidebarOpen);
	let sidebarPane = $state<Pane | null>(null);
	let savedSidebarSize = $state(14);
	let isSidebarAnimating = $state(false);
	let showSidebarContent = $state(initialSidebarOpen);
	let showClosedTrigger = $state(!initialSidebarOpen);
	let showResizeHandle = $state(initialSidebarOpen);
	let animationId = 0;
	let hasHydrated = $state(false);
	let hasSyncedInitialPane = $state(false);
	let lastSidebarOpen = initialSidebarOpen;

	async function animateSidebarPane(targetSize: number, currentAnimationId: number) {
		if (!sidebarPane) return;

		const startSize = sidebarPane.getSize();
		const duration = 180;
		const startTime = performance.now();

		if (startSize === targetSize) {
			sidebarPane.resize(targetSize);
			return;
		}

		while (true) {
			if (currentAnimationId !== animationId || !sidebarPane) return;

			const elapsed = performance.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			sidebarPane.resize(startSize + (targetSize - startSize) * eased);

			if (progress >= 1) return;

			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
	}

	$effect(() => {
		if (!browser || !sidebarPane || hasSyncedInitialPane) return;

		hasSyncedInitialPane = true;

		const size = sidebarPane.getSize();
		if (initialSidebarOpen) {
			if (size > 0) {
				savedSidebarSize = size;
			} else {
				sidebarPane.resize(savedSidebarSize);
			}
			return;
		}

		sidebarPane.resize(0);
	});

	$effect(() => {
		if (!browser) return;
		if (!hasHydrated) {
			hasHydrated = true;
			return;
		}
		if (sidebarOpen === lastSidebarOpen) return;
		lastSidebarOpen = sidebarOpen;

		const currentAnimationId = ++animationId;
		isSidebarAnimating = true;

		if (sidebarOpen) {
			showSidebarContent = true;
			showResizeHandle = true;
			showClosedTrigger = false;
		}

		animateSidebarPane(sidebarOpen ? savedSidebarSize : 0, currentAnimationId).then(() => {
			if (currentAnimationId !== animationId) return;
			isSidebarAnimating = false;
			showSidebarContent = sidebarOpen;
			showResizeHandle = sidebarOpen;
			showClosedTrigger = !sidebarOpen;
		});
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<SidebarProvider bind:open={sidebarOpen}>
	<Resizable.PaneGroup autoSaveId="polycode-shell-sidebar" direction="horizontal">
		<Resizable.Pane
			bind:this={sidebarPane}
			class="min-w-0 overflow-hidden"
			defaultSize={initialSidebarOpen ? 14 : 0}
			minSize={0}
			maxSize={24}
			onResize={(size) => {
				if (!isSidebarAnimating && size > 0) savedSidebarSize = size;
			}}
		>
			<div
				class:hidden={!showSidebarContent}
				class={`h-svh ${showSidebarContent ? 'translate-x-0 opacity-100' : 'pointer-events-none opacity-0'}`}
			>
				<AppSidebar sidebarProjects={data.sidebarProjects} />
			</div>
		</Resizable.Pane>
		{#if showResizeHandle}
			<Resizable.Handle />
		{/if}
		<Resizable.Pane class="min-w-0" defaultSize={initialSidebarOpen ? 86 : 100}>
			<main class="h-svh w-full">
				{#if showClosedTrigger}
					<div class="flex p-2">
						<Tooltip.Root delayDuration={400}>
							<Tooltip.Trigger>
								<Button
									variant="ghost"
									size="icon-lg"
									aria-label="Show sidebar"
									onclick={() => {
										sidebarOpen = true;
										document.cookie = `${SIDEBAR_COOKIE_NAME}=true; path=/; max-age=${60 * 60 * 24 * 7}`;
									}}
								>
									<ArrowRightFromLine class="size-5" />
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content class="opacity-90">Show sidebar</Tooltip.Content>
						</Tooltip.Root>
					</div>
				{/if}
				{@render children()}
			</main>
		</Resizable.Pane>
	</Resizable.PaneGroup>
</SidebarProvider>
