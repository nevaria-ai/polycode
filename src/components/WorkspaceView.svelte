<script lang="ts">
	import { ChevronRight, ChevronDown, Plus, Trash2, Pencil, Archive } from '@lucide/svelte';
	import type { WorktreeWithSessions, Session } from '$lib/sessions';
	import { Button } from '$components/ui/button';
	import * as Dialog from '$components/ui/dialog';
	import { browser } from '$app/environment';
	import { encodeProjectId } from '$lib/projects';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let {
		worktrees,
		projectPath,
		projectId,
		onNewSession
	}: {
		worktrees: WorktreeWithSessions[];
		projectPath: string;
		projectId: string;
		onNewSession?: (worktreePath: string) => void;
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

	// Delete worktree dialog state
	let deleteDialogOpen = $state(false);
	let worktreeToDelete = $state<WorktreeWithSessions | null>(null);
	let deleteError = $state('');

	// Remove session dialog state
	let removeSessionDialogOpen = $state(false);
	let sessionToRemove = $state<Session | null>(null);

	// Inline rename state
	let editingSessionId = $state<string | null>(null);
	let editTitleValue = $state('');

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

	function getSessionDisplayName(session: Session, index: number): string {
		if (session.title !== null) return session.title;
		return `Session ${index + 1}`;
	}

	// Clear delete error on dialog close
	$effect(() => {
		if (!deleteDialogOpen) {
			deleteError = '';
		}
	});

	function openDeleteWorktreeDialog(worktree: WorktreeWithSessions) {
		worktreeToDelete = worktree;
		deleteDialogOpen = true;
	}

	function openRemoveSessionDialog(session: Session) {
		sessionToRemove = session;
		removeSessionDialogOpen = true;
	}

	function startRename(session: Session, index: number) {
		editingSessionId = session.id;
		editTitleValue = getSessionDisplayName(session, index);
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
							{#each worktree.sessions as session, index (session.id)}
								<div
									class="group/session flex items-center gap-1 rounded px-2 py-1.5 text-xs text-zinc-300 transition-colors {editingSessionId ===
									session.id
										? 'bg-white/6 ring-1 ring-white/20'
										: 'hover:bg-white/6 hover:text-zinc-100'}"
								>
									{#if editingSessionId === session.id}
										<form
											method="POST"
											action={resolve('/projects/[projectId]', { projectId }) + '?/renameSession'}
											use:enhance={() => {
												return async ({ result, update }) => {
													if (result.type === 'success') {
														editingSessionId = null;
														await update({ reset: false });
													}
												};
											}}
											class="flex-1"
										>
											<input type="hidden" name="sessionId" value={session.id} />
											<input
												type="text"
												name="title"
												bind:value={editTitleValue}
												class="w-full bg-transparent text-xs outline-none"
												autofocus
												onblur={(e) => (e.target as HTMLInputElement).form?.requestSubmit()}
												onkeydown={(e) => {
													if (e.key === 'Escape') {
														e.preventDefault();
														editingSessionId = null;
													}
												}}
											/>
										</form>
									{:else}
										<a
											href={resolve('/projects/[projectId]/session/[sessionId]', {
												projectId,
												sessionId: session.id
											})}
											class="flex-1 cursor-pointer"
										>
											{getSessionDisplayName(session, index)}
										</a>
										<button
											type="button"
											aria-label="Rename session"
											class="flex size-4 shrink-0 cursor-pointer items-center justify-center opacity-0 transition-opacity group-hover/session:opacity-60"
											onclick={() => startRename(session, index)}
										>
											<Pencil class="size-3" />
										</button>
										<button
											type="button"
											aria-label="Remove session"
											class="flex size-4 shrink-0 cursor-pointer items-center justify-center opacity-0 transition-opacity group-hover/session:opacity-60"
											onclick={() => openRemoveSessionDialog(session)}
										>
											<Archive class="size-3" />
										</button>
									{/if}
								</div>
							{/each}
						</div>

						<!-- New Session Button -->
						<Button
							variant="ghost"
							class="mt-2 w-full cursor-pointer justify-start gap-1.5 rounded text-zinc-300 hover:!bg-white/6 hover:!text-zinc-100"
							onclick={() => onNewSession?.(worktree.path)}
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

<!-- Delete Worktree Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="overflow-hidden sm:max-w-md">
		<form
			method="POST"
			action={resolve('/projects/[projectId]', { projectId }) + '?/deleteWorktree'}
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

<!-- Remove Session Confirmation Dialog -->
<Dialog.Root bind:open={removeSessionDialogOpen}>
	<Dialog.Content class="overflow-hidden sm:max-w-md">
		<form
			method="POST"
			action={resolve('/projects/[projectId]', { projectId }) + '?/removeSessionEntry'}
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						const data = result.data as Record<string, string | undefined>;
						if (data?.error) {
							return;
						}
					}
					removeSessionDialogOpen = false;
					await update({ reset: false });
				};
			}}
			class="grid gap-4"
		>
			<Dialog.Header>
				<Dialog.Title>Remove Session</Dialog.Title>
				<Dialog.Description
					>This will remove the session from your list. The session data in the CLI tool will not be
					affected. Continue?</Dialog.Description
				>
			</Dialog.Header>

			<input type="hidden" name="sessionId" value={sessionToRemove?.id} />

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (removeSessionDialogOpen = false)}
					>Cancel</Button
				>
				<Button type="submit" variant="destructive">Remove</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
