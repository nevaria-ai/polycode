<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import * as Dialog from '$components/ui/dialog';
	import { createWorktree, renameWorktree } from '$lib/services';
	import { invalidateAll } from '$app/navigation';

	type BranchDialogMode =
		| { mode: 'create'; projectId: string }
		| { mode: 'rename'; projectId: string; worktreePath: string; oldBranch: string }
		| null;

	let { branchDialogState = $bindable(null) }: { branchDialogState?: BranchDialogMode } = $props();

	let branchName = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (branchDialogState?.mode === 'rename' && 'oldBranch' in branchDialogState) {
			branchName = branchDialogState.oldBranch;
		} else if (branchDialogState === null) {
			branchName = '';
		}
		error = null;
	});

	async function handleSubmit() {
		if (!branchDialogState || !branchName.trim()) return;

		submitting = true;
		error = null;
		try {
			if (branchDialogState.mode === 'create') {
				await createWorktree(branchDialogState.projectId, {
					branch: branchName.trim()
				});
			} else {
				const oldBranch = branchDialogState.oldBranch;
				await renameWorktree(branchDialogState.projectId, branchDialogState.worktreePath, {
					oldBranch,
					newBranch: branchName.trim()
				});
			}
			branchDialogState = null;
			await invalidateAll();
		} catch (e) {
			error = e instanceof Error ? e.message : `Failed to ${branchDialogState?.mode} branch`;
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog.Root
	open={branchDialogState !== null}
	onOpenChange={(open) => {
		if (!open) branchDialogState = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title
				>{branchDialogState?.mode === 'rename' ? 'Rename Branch' : 'Create Worktree'}</Dialog.Title
			>
			<Dialog.Description>
				{branchDialogState?.mode === 'rename'
					? 'Enter a new name for the branch'
					: 'Enter a name for the new branch'}
			</Dialog.Description>
		</Dialog.Header>

		{#if error}
			<p class="text-sm break-words text-red-400">{error}</p>
		{/if}

		<div class="grid gap-4 py-4">
			<Input
				name="branchName"
				bind:value={branchName}
				placeholder="e.g. feature/my-feature"
				autofocus
			/>
		</div>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => (branchDialogState = null)}
				>Cancel</Button
			>
			<Button type="button" onclick={handleSubmit} disabled={!branchName.trim() || submitting}>
				{branchDialogState?.mode === 'rename' ? 'Rename' : 'Create'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
