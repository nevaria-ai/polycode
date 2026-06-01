<script lang="ts">
	import { tick } from 'svelte';
	import { createProject, getDirectories } from '$lib/services';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$components/ui/button';
	import * as Command from '$components/ui/command';
	import * as Dialog from '$components/ui/dialog';
	import { Input } from '$components/ui/input';
	import * as Popover from '$components/ui/popover';
	import { FolderOpen } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let inputRef = $state<HTMLInputElement | null>(null);
	let searchQuery = $state('');
	let directorySuggestions = $state<string[]>([]);
	let highlightedIndex = $state(-1);
	let suggestionsOpen = $state(false);
	let pathExists = $state(false);
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let acceptedSuggestion = $state<string | null>(null);
	let latestRequestId = 0;

	function clearSuggestions() {
		directorySuggestions = [];
		highlightedIndex = -1;
		suggestionsOpen = false;
	}

	function resetInputState() {
		searchQuery = '';
		pathExists = false;
		acceptedSuggestion = null;
		error = null;
		latestRequestId += 1;
		clearSuggestions();
	}

	function normalizePath(path: string) {
		if (path === '/') return path;
		return path.endsWith('/') ? path.slice(0, -1) : path;
	}

	async function scrollHighlightedItemIntoView() {
		await tick();

		if (highlightedIndex < 0) return;

		const item = document.querySelector(
			`[data-suggestion-index="${highlightedIndex}"]`
		) as HTMLElement | null;
		item?.scrollIntoView({ block: 'nearest' });
	}

	function setHighlightedIndex(index: number) {
		highlightedIndex = index;
		void scrollHighlightedItemIntoView();
	}

	function selectSuggestion(dir: string) {
		searchQuery = dir;
		acceptedSuggestion = dir;
		clearSuggestions();
	}

	$effect(() => {
		if (!open) {
			resetInputState();
			return;
		}

		void fetchDirectorySuggestions(searchQuery);
	});

	async function fetchDirectorySuggestions(query: string) {
		const requestId = ++latestRequestId;
		const trimmedQuery = query.trim();
		const normalizedQuery = normalizePath(query.trim());

		if (!normalizedQuery) {
			pathExists = false;
			acceptedSuggestion = null;
			clearSuggestions();
			return;
		}

		if (acceptedSuggestion && acceptedSuggestion !== trimmedQuery) {
			acceptedSuggestion = null;
		}

		try {
			const { suggestions, exists } = await getDirectories(query);
			if (requestId !== latestRequestId) return;

			pathExists = exists;
			directorySuggestions = suggestions;

			if (suggestions.length === 0) {
				highlightedIndex = -1;
				suggestionsOpen = false;
				return;
			}

			highlightedIndex = Math.min(Math.max(highlightedIndex, 0), suggestions.length - 1);

			if (acceptedSuggestion && acceptedSuggestion === trimmedQuery) {
				suggestionsOpen = false;
				return;
			}

			suggestionsOpen = true;
			void scrollHighlightedItemIntoView();
		} catch {
			if (requestId !== latestRequestId) return;
			pathExists = false;
			clearSuggestions();
		}
	}

	function moveHighlight(direction: 1 | -1) {
		if (directorySuggestions.length === 0) return;

		const nextIndex =
			highlightedIndex < 0
				? direction > 0
					? 0
					: directorySuggestions.length - 1
				: Math.min(Math.max(highlightedIndex + direction, 0), directorySuggestions.length - 1);

		setHighlightedIndex(nextIndex);
		suggestionsOpen = true;
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			clearSuggestions();
			return;
		}

		if (directorySuggestions.length === 0) return;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				moveHighlight(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveHighlight(-1);
				break;
			case 'Enter':
			case 'Tab':
				if (suggestionsOpen && highlightedIndex >= 0) {
					event.preventDefault();
					selectSuggestion(directorySuggestions[highlightedIndex]);
				}
				break;
		}
	}
	async function handleSubmit() {
		if (!searchQuery.trim() || !pathExists || submitting) return;

		submitting = true;
		error = null;
		try {
			await createProject(searchQuery.trim());
			open = false;
			await invalidateAll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create project';
		} finally {
			submitting = false;
		}
	}

	function handleFormKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !suggestionsOpen) {
			event.preventDefault();
			void handleSubmit();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Open Project</Dialog.Title>
			<Dialog.Description>Enter the path to your project directory</Dialog.Description>
		</Dialog.Header>

		{#if error}
			<p class="text-sm break-words text-red-400">{error}</p>
		{/if}

		<div class="grid gap-4 py-4" onkeydown={handleFormKeydown}>
			<Popover.Root bind:open={suggestionsOpen}>
				<div class="relative grid gap-2">
					<Input
						bind:ref={inputRef}
						bind:value={searchQuery}
						name="path"
						placeholder="e.g. / or ~/Projects/ - add / to list contents"
						onkeydown={handleInputKeydown}
						class="pr-10"
					/>
					{#if searchQuery}
						<button
							type="button"
							onclick={resetInputState}
							class="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						>
							✕
						</button>
					{/if}

					{#if inputRef}
						<Popover.Content
							customAnchor={inputRef}
							class="w-(--bits-popover-anchor-width) p-1"
							onOpenAutoFocus={(event) => event.preventDefault()}
						>
							<Command.Root class="p-0">
								<Command.List class="max-h-60" style="max-height: 15rem;">
									{#each directorySuggestions as dir, index (dir)}
										<Command.Item
											data-suggestion-index={index}
											data-highlighted={highlightedIndex === index ? 'true' : undefined}
											value={dir}
											onSelect={() => selectSuggestion(dir)}
											onmouseenter={() => setHighlightedIndex(index)}
											class={cn(
												'cursor-pointer data-selected:bg-transparent data-selected:text-foreground data-[highlighted=true]:bg-accent data-selected:*:[svg]:text-muted-foreground'
											)}
										>
											<FolderOpen class="size-4 shrink-0 text-muted-foreground" />
											<span class="flex-1 truncate text-left">{dir}</span>
										</Command.Item>
									{/each}
								</Command.List>
							</Command.Root>
						</Popover.Content>
					{/if}
				</div>
			</Popover.Root>
		</div>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button
				type="button"
				disabled={!searchQuery.trim() || !pathExists || submitting}
				onclick={handleSubmit}>Open</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
