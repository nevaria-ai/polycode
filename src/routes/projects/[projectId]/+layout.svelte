<script lang="ts">
	import type { LayoutData } from './$types';
	import CliPickerDialog from '$components/CliPickerDialog.svelte';
	import CliConfigDialog from '$components/CliConfigDialog.svelte';
	let { data, children } = $props<{ data: LayoutData; children: import('svelte').Snippet }>();
</script>

<div class="h-full min-h-0">
	{@render children()}
</div>

<CliPickerDialog profiles={data.cliProfiles} projectId={data.project?.id} />
<CliConfigDialog />
