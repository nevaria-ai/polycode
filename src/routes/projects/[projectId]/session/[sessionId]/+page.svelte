<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

{#if data.session}
	<section class="flex h-full items-center justify-center p-8">
		<div class="max-w-md rounded-2xl border border-white/8 bg-white/3 p-8 text-center">
			<p class="text-sm text-zinc-400">
				Session: {data.session.title ?? data.session.id.slice(0, 8)}
			</p>
		</div>
	</section>
{:else}
	<section class="flex h-full items-center justify-center p-8">
		<div class="max-w-md rounded-2xl border border-white/8 bg-white/3 p-8 text-center">
			<p class="text-sm text-zinc-400">Start a new session from the sidebar.</p>
		</div>
	</section>
{/if}
