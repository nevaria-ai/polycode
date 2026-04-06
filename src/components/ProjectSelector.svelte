<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Plus } from '@lucide/svelte';

	const project = {
		name: 'Project',
		bg: '#d4850a'
	};

	let selected = $state(true);

	function dimColor(hex: string, opacity: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}
</script>

<aside class="flex w-14 flex-col items-center gap-3 border-0 bg-(--surface-1) py-4">
	<div class="flex flex-col gap-3">
		<Button
			variant="secondary"
			size="icon"
			data-slot="project-button"
			aria-selected={selected}
			class="size-9 shrink-0 rounded-md font-semibold transition-colors hover:brightness-140 aria-selected:bg-white/10 aria-selected:text-lg"
			style="background-color: {dimColor(
				project.bg,
				0.2
			)}; color: {project.bg}; --hover-bg: {dimColor(project.bg, 0.35)}"
			onclick={() => (selected = !selected)}
		>
			{project.name.charAt(0).toUpperCase()}
		</Button>
	</div>
	<Button variant="ghost" size="icon" class="size-9 hover:bg-white/15!" title="New project">
		<Plus class="size-6" />
	</Button>
</aside>
