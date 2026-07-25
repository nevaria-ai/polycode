<script lang="ts">
	import { Button } from '$components/ui/button';
	import * as Dialog from '$components/ui/dialog';
	import { commands, unwrapCommand } from '$lib/command';
	import { invalidate } from '$app/navigation';

	type WorktreeDeleteTarget = {
		projectId: string;
		worktreeId: string;
		branch: string;
	};

	let { info = $bindable(null) }: { info?: WorktreeDeleteTarget | null } = $props();

	let submitting = $state(false);
	let error = $state<string | null>(null);

	function closeDialog() {
		info = null;
		error = null;
	}

	async function handleConfirm() {
		if (!info) return;

		submitting = true;
		error = null;
		try {
			await commands.deleteWorktree(info.projectId, info.worktreeId).then(unwrapCommand);
			closeDialog();
			await invalidate('projects:list');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete worktree or branch';
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog.Root
	open={info !== null}
	onOpenChange={(open) => {
		if (!open) closeDialog();
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete Worktree</Dialog.Title>
			<Dialog.Description
				>Are you sure you want to delete the <strong>{info?.branch}</strong> worktree and its branch?
				Delete fails if the checkout is dirty or the branch is not fully merged.</Dialog.Description
			>
		</Dialog.Header>

		{#if error}
			<p class="text-sm break-words text-destructive">{error}</p>
		{/if}

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={closeDialog}>Cancel</Button>
			<Button type="button" variant="destructive" onclick={handleConfirm} disabled={submitting}>
				Delete</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
