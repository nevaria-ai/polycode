<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import * as Dialog from '$components/ui/dialog';
	import { FolderOpen } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let searchQuery = $state('');
	let directorySuggestions = $state<string[]>([]);
	let highlightedIndex = $state(-1);

	// Fetch suggestions when searchQuery changes
	$effect(() => {
		fetchDirectorySuggestions(searchQuery);
	});

	async function fetchDirectorySuggestions(query: string) {
		if (!query || query.length < 1) {
			directorySuggestions = [];
			highlightedIndex = -1;
			return;
		}

		try {
			const response = await fetch(`/api/directories?q=${encodeURIComponent(query)}`);
			if (response.ok) {
				const dirs = await response.json();
				directorySuggestions = dirs;
				highlightedIndex = dirs.length > 0 ? 0 : -1;
			}
		} catch {
			directorySuggestions = [];
			highlightedIndex = -1;
		}
	}

	function selectSuggestion(dir: string) {
		searchQuery = dir;
		directorySuggestions = [];
		highlightedIndex = -1;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (directorySuggestions.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlightedIndex = Math.min(highlightedIndex + 1, directorySuggestions.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightedIndex = Math.max(highlightedIndex - 1, 0);
				break;
			case 'Tab':
				if (highlightedIndex >= 0 && highlightedIndex < directorySuggestions.length) {
					e.preventDefault();
					selectSuggestion(directorySuggestions[highlightedIndex]);
				}
				break;
			case 'Enter':
				if (highlightedIndex >= 0 && highlightedIndex < directorySuggestions.length) {
					e.preventDefault();
					searchQuery = directorySuggestions[highlightedIndex];
					directorySuggestions = [];
					highlightedIndex = -1;
				}
				break;
			case 'Escape':
				directorySuggestions = [];
				highlightedIndex = -1;
				break;
		}
	}

	function handleInputKeydown(e: Event) {
		const keyEvent = e as KeyboardEvent;
		if (keyEvent.key === 'Enter' && highlightedIndex >= 0 && directorySuggestions.length > 0) {
			e.preventDefault();
			selectSuggestion(directorySuggestions[highlightedIndex]);
		} else if (
			keyEvent.key === 'ArrowDown' ||
			keyEvent.key === 'ArrowUp' ||
			keyEvent.key === 'Tab'
		) {
			handleKeydown(keyEvent);
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Open Project</Dialog.Title>
			<Dialog.Description>Enter the path to your project directory</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="/projects/?/add">
			<div class="grid gap-4 py-4">
				<div class="relative grid gap-2">
					<Input
						bind:value={searchQuery}
						name="path"
						placeholder="e.g. / or ~/Projects/ - add / to list contents"
						onkeydown={handleInputKeydown}
						class="pr-10"
					/>
					{#if searchQuery}
						<button
							type="button"
							onclick={() => {
								searchQuery = '';
								directorySuggestions = [];
								highlightedIndex = -1;
							}}
							class="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						>
							✕
						</button>
					{/if}

					{#if directorySuggestions.length > 0}
						<ul
							class="absolute top-full z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
							role="listbox"
						>
							{#each directorySuggestions as dir, index (dir)}
								<li>
									<button
										type="button"
										class={cn(
											'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground',
											highlightedIndex === index && 'bg-accent'
										)}
										onclick={() => selectSuggestion(dir)}
										onmouseenter={() => (highlightedIndex = index)}
										onkeydown={handleKeydown}
										role="option"
										aria-selected={highlightedIndex === index}
									>
										<FolderOpen class="size-4 shrink-0 text-muted-foreground" />
										<span class="flex-1 truncate text-left">{dir}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!searchQuery.trim()}>Open</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
