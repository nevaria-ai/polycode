<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Card, CardContent } from '$components/ui/card';
	import * as Dialog from '$components/ui/dialog';
	import { Plus, Settings } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import type { CliProfile } from '$lib/cli-profiles';

	const NEW_CARD_ID = '__new__';

	type PickerCard =
		| (CliProfile & { isAddCard?: false })
		| { id: typeof NEW_CARD_ID; isAddCard: true };

	let {
		open = $bindable(false),
		profiles = [],
		onSelect = () => {},
		onEdit = () => {}
	}: {
		open?: boolean;
		profiles?: CliProfile[];
		onSelect?: (profile: CliProfile) => void;
		onEdit?: (profile?: CliProfile) => void;
	} = $props();

	let cards = $derived<PickerCard[]>([...profiles, { id: NEW_CARD_ID, isAddCard: true }]);
	let gridCols = $derived(cards.length >= 3 ? 'grid-cols-3' : 'grid-cols-2');

	function handleSelect(profile: CliProfile) {
		onSelect(profile);
		open = false;
	}

	function handleEdit(profile?: CliProfile) {
		onEdit(profile);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Select CLI Tool</Dialog.Title>
			<Dialog.Description>Choose a CLI tool to start your session</Dialog.Description>
		</Dialog.Header>

		<div class="py-4">
			<div class="grid {gridCols} gap-3">
				{#each cards as card (card.id)}
					<button
						type="button"
						class="group w-full"
						onclick={() => {
							if ('isAddCard' in card && card.isAddCard) {
								handleEdit(undefined);
							} else {
								handleSelect(card as CliProfile);
							}
						}}
					>
						<Card
							class={cn(
								'relative flex w-full flex-col items-center justify-center transition-colors',
								'hover:ring-1 hover:ring-foreground/20'
							)}
						>
							{#if 'isAddCard' in card && card.isAddCard}
								<CardContent class="flex flex-col items-center justify-center gap-2 py-5">
									<Plus
										class="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
									/>
									<span
										class="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground"
									>
										Add CLI
									</span>
								</CardContent>
							{:else}
								<CardContent class="flex flex-col items-center justify-center gap-1 py-5">
									<span class="text-xs font-medium">
										{(card as CliProfile).name}
									</span>
									<span class="text-[10px] text-muted-foreground">
										{(card as CliProfile).command}
									</span>
								</CardContent>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									class="absolute top-1 right-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
									onclick={(e) => {
										e.stopPropagation();
										handleEdit(card as CliProfile);
									}}
									aria-label="Edit {(card as CliProfile).name} profile"
								>
									<Settings class="size-3.5" />
								</Button>
							{/if}
						</Card>
					</button>
				{/each}
			</div>
		</div>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
