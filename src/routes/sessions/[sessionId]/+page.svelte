<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
	const sessionLabel = $derived(data.session?.title ?? data.session?.id.slice(0, 8) ?? null);
</script>

<div class="flex h-full min-w-0 flex-col">
	<div class="custom-scrollbar flex-1 overflow-y-auto">
		<div class="content-container py-4">
			{#if data.session}
				<div class="flex min-w-0 flex-col gap-4">
					<div class="rounded-2xl border border-white/8 bg-white/3 p-6">
						<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">Session</p>
						<p class="mt-2 text-sm break-words text-zinc-200">{sessionLabel}</p>
					</div>
				</div>
			{:else}
				<div class="rounded-2xl border border-white/8 bg-white/3 p-6 text-center">
					<p class="text-sm text-zinc-400">Start a new session from the sidebar.</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	@reference '../../layout.css';

	.content-container {
		@apply mx-auto w-full min-w-0 px-6 md:max-w-[min(60%,_768px)];
	}

	.custom-scrollbar {
		scrollbar-color: var(--muted-foreground) transparent;
	}
</style>
