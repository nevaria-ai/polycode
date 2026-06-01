<script lang="ts">
	import { Button } from '$components/ui/button';
	import * as Dialog from '$components/ui/dialog';
	import { deleteWorktree } from '$lib/services';
	import { invalidateAll } from '$app/navigation';

	type WorktreeInfo = {
		projectId: string;
		worktreePath: string;
		branch: string;
	};

	let { info = $bindable(null) }: { info?: WorktreeInfo | null } = $props();

	let submitting = $state(false);

	async function handleConfirm() {
		if (!info) return;

		submitting = true;
		try {
			await deleteWorktree(info.projectId, info.worktreePath, {
				branch: info.branch
			});
			info = null;
			await invalidateAll();
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog.Root
	open={info !== null}
	onOpenChange={(open) => {
		if (!open) info = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete Worktree</Dialog.Title>
			<Dialog.Description
				>Are you sure you want to delete the <strong>{info?.branch}</strong> worktree and its branch?
				This action cannot be undone.</Dialog.Description
			>
		</Dialog.Header>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => (info = null)}>Cancel</Button>
			<Button type="button" variant="destructive" onclick={handleConfirm} disabled={submitting}>
				Delete</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
