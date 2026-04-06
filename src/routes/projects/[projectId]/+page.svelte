<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

{#if data.project}
	<section class="flex h-full items-center justify-center p-8">
		<div class="w-full max-w-xl rounded-2xl border border-white/8 bg-white/3 p-8">
			<p class="text-xs tracking-[0.22em] text-zinc-500 uppercase">Project</p>
			<h1 class="mt-3 text-2xl font-semibold">{data.project.name}</h1>
			<p class="mt-2 text-sm break-all text-zinc-400">{data.project.path}</p>
			<p class="mt-6 text-sm text-zinc-400">
				Worktrees, sessions, and history arrive in later phases.
			</p>
			<form method="POST" action="/projects/?/close">
				<input type="hidden" name="projectId" value={page.params.projectId} />
				<button type="submit" class="mt-8 text-sm text-red-300">Close project</button>
			</form>
		</div>
	</section>
{:else}
	<section class="flex h-full items-center justify-center p-8">
		<div class="max-w-md rounded-2xl border border-white/8 bg-white/3 p-8 text-center">
			<h1 class="text-xl font-semibold">Project not found</h1>
		</div>
	</section>
{/if}
