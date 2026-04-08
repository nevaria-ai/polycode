<script lang="ts">
	import { ChevronRight, ChevronDown, Plus, Trash2 } from '@lucide/svelte';
	import type { WorktreeEntry } from '$lib/server/git';
	import { Button } from '$components/ui/button';
	import * as Dialog from '$components/ui/dialog';
	import { browser } from '$app/environment';
	import { encodeProjectId } from '$lib/projects';
	import { enhance } from '$app/forms';

	let {
		worktrees,
		projectPath,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		projectId,
		onNewSession
	}: {
		worktrees: WorktreeEntry[];
		projectPath: string;
		projectId: string;
		onNewSession?: () => void;
	} = $props();

	// Storage key for this project's expanded worktrees
	const storageKey = $derived(`expanded-worktrees-${encodeProjectId(projectPath)}`);

	// Load expanded state from localStorage
	function loadExpandedState(): Record<string, boolean> {
		if (!browser) return {};
		const stored = localStorage.getItem(storageKey);
		if (!stored) return {};
		try {
			return JSON.parse(stored);
		} catch {
			return {};
		}
	}

	// Track which worktrees are expanded
	const expanded = $state<Record<string, boolean>>(loadExpandedState());

	// Delete dialog state
	let deleteDialogOpen = $state(false);
	let worktreeToDelete = $state<WorktreeEntry | null>(null);
	let deleteError = $state('');

	// Save to localStorage whenever expanded state changes
	$effect(() => {
		if (browser) {
			localStorage.setItem(storageKey, JSON.stringify(expanded));
		}
	});

	function toggleWorktree(path: string) {
		expanded[path] = !expanded[path];
	}

	function isExpanded(path: string): boolean {
		return expanded[path] === true;
	}

	// Clear delete error on dialog close
	$effect(() => {
		if (!deleteDialogOpen) {
			deleteError = '';
		}
	});

	function openDeleteWorktreeDialog(worktree: WorktreeEntry) {
		worktreeToDelete = worktree;
		deleteDialogOpen = true;
	}
</script>

{#if worktrees && worktrees.length === 0}
	<div class="p-4 text-sm text-zinc-400">No worktrees found</div>
{:else if worktrees}
	<div class="flex flex-col">
		{#each worktrees as worktree (worktree.path)}
			<div class="border-b border-white/8">
				<!-- Worktree Header (Clickable) -->
				<div
					onclick={(e) => {
						// Prevent toggling if delete button was clicked
						if ((e.target as HTMLElement).closest('button')) return;
						toggleWorktree(worktree.path);
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							toggleWorktree(worktree.path);
						}
					}}
					role="button"
					tabindex="0"
					class="group flex w-full items-center gap-2 p-3 transition-colors hover:bg-white/6"
				>
					{#if isExpanded(worktree.path)}
						<ChevronDown class="size-4 shrink-0 text-zinc-400" />
					{:else}
						<ChevronRight class="size-4 shrink-0 text-zinc-400" />
					{/if}
					<span class="flex-1 text-sm text-zinc-300">{worktree.branch || '(detached)'}</span>

					<!-- Delete Button (visible on hover) -->
					<Button
						variant="ghost"
						size="icon"
						aria-label="Delete worktree"
						onclick={() => openDeleteWorktreeDialog(worktree)}
						class="size-4 cursor-pointer opacity-0 transition-opacity group-hover:opacity-60"
					>
						<Trash2 class="size-3.5" />
					</Button>
				</div>

				<!-- Expandable Content: Sessions List -->
				{#if isExpanded(worktree.path)}
					<div class="px-3 pb-3">
						<!-- Session List -->
						<div class="flex flex-col gap-1">
							<a
								href=""
								onclick={(e) => e.preventDefault()}
								class="cursor-pointer rounded px-2 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/6 hover:text-zinc-100"
							>
								Session 1
							</a>
							<a
								href=""
								onclick={(e) => e.preventDefault()}
								class="cursor-pointer rounded px-2 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/6 hover:text-zinc-100"
							>
								Session 2
							</a>
						</div>

						<!-- New Session Button -->
						<Button
							variant="ghost"
							class="mt-2 w-full cursor-pointer justify-start gap-1.5 rounded text-zinc-300 hover:!bg-white/6 hover:!text-zinc-100"
							onclick={() => onNewSession?.()}
						>
							<Plus class="size-4" />
							New session
						</Button>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{:else}
	<div class="p-4 text-sm text-zinc-400">Loading worktrees...</div>
{/if}

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="overflow-hidden sm:max-w-md">
		<form
			method="POST"
			action="?/deleteWorktree"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						const data = result.data as Record<string, string | undefined>;
						if (data?.error) {
							deleteError = data.error;
						} else {
							await update({ reset: false });
							deleteDialogOpen = false;
						}
					}
				};
			}}
			class="grid gap-4"
		>
			<Dialog.Header>
				<Dialog.Title>Delete Worktree</Dialog.Title>
				{#if worktreeToDelete?.status === 'unmerged'}
					<Dialog.Description class="text-destructive">
						Warning: unmerge changes detected in worktree. Are you sure you want to continue?
					</Dialog.Description>
				{:else if worktreeToDelete?.status === 'uncommitted'}
					<Dialog.Description class="text-destructive">
						Warning: uncommitted changes detected in worktree. Are you sure you want to continue?
					</Dialog.Description>
				{:else if worktreeToDelete?.isMerged}
					<Dialog.Description>
						This branch appears to be fully merged. Delete this worktree?
					</Dialog.Description>
				{:else}
					<Dialog.Description
						>This worktree may contain unpushed or unrecoverable changes. Delete anyway?</Dialog.Description
					>
				{/if}
			</Dialog.Header>

			{#if deleteError}
				<p class="text-sm break-words text-red-400">{deleteError}</p>
			{/if}

			<input type="hidden" name="worktreePath" value={worktreeToDelete?.path} />
			<input type="hidden" name="branch" value={worktreeToDelete?.branch ?? ''} />

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (deleteDialogOpen = false)}
					>Cancel</Button
				>
				<Button type="submit" variant="destructive">Delete</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
