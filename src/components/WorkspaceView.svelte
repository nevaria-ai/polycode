<script lang="ts">
	import { ChevronRight, ChevronDown, Plus } from '@lucide/svelte';
	import type { WorktreeEntry } from '$lib/server/git';
	import { Button } from '$components/ui/button';
	import { browser } from '$app/environment';
	import { encodeProjectId } from '$lib/projects';

	let { worktrees, projectPath }: { worktrees: WorktreeEntry[]; projectPath: string } = $props();

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
</script>

{#if worktrees && worktrees.length === 0}
	<div class="p-4 text-sm text-zinc-400">No worktrees found</div>
{:else if worktrees}
	<div class="flex flex-col">
		{#each worktrees as worktree (worktree.path)}
			<div class="border-b border-white/8">
				<!-- Worktree Header (Clickable) -->
				<div
					onclick={() => toggleWorktree(worktree.path)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							toggleWorktree(worktree.path);
						}
					}}
					role="button"
					tabindex="0"
					class="flex items-center gap-2 p-3 transition-colors hover:bg-white/6"
				>
					{#if isExpanded(worktree.path)}
						<ChevronDown class="size-4 shrink-0 text-zinc-400" />
					{:else}
						<ChevronRight class="size-4 shrink-0 text-zinc-400" />
					{/if}
					<span class="text-sm text-zinc-300">{worktree.branch || '(detached)'}</span>
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
