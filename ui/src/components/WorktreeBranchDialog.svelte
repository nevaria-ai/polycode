<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import * as Dialog from '$components/ui/dialog';
	import { commands, unwrapCommand } from '$lib/command';
	import { invalidate } from '$app/navigation';

	type BranchDialogMode =
		| { mode: 'create'; projectId: string }
		| { mode: 'rename'; projectId: string; worktreeId: string }
		| null;

	let { branchDialogState = $bindable(null) }: { branchDialogState?: BranchDialogMode } = $props();

	let branchName = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (branchDialogState === null) {
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
				await commands
					.createWorktree(branchDialogState.projectId, {
						branch: branchName.trim()
					})
					.then(unwrapCommand);
			} else {
				await commands
					.renameWorktreeBranch(branchDialogState.projectId, branchDialogState.worktreeId, {
						newBranch: branchName.trim()
					})
					.then(unwrapCommand);
			}
			branchDialogState = null;
			await invalidate('projects:list');
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
			<p class="text-sm break-words text-destructive">{error}</p>
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
