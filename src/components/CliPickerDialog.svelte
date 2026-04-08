<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Card, CardContent } from '$components/ui/card';
	import * as Dialog from '$components/ui/dialog';
	import { Plus, Settings } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import type { CliProfile } from '$lib/cli-profiles';
	import { enhance } from '$app/forms';

	const NEW_CARD_ID = '__new__';

	type PickerCard =
		| (CliProfile & { isAddCard?: false })
		| { id: typeof NEW_CARD_ID; isAddCard: true };

	let {
		open = $bindable(false),
		profiles = [],
		worktreePath = null,
		onSuccess = () => {},
		onEdit = () => {}
	}: {
		open?: boolean;
		profiles?: CliProfile[];
		worktreePath?: string | null;
		onSuccess?: () => void;
		onEdit?: (profile?: CliProfile) => void;
	} = $props();

	let cards = $derived<PickerCard[]>([...profiles, { id: NEW_CARD_ID, isAddCard: true }]);
	let gridCols = $derived(cards.length >= 3 ? 'grid-cols-3' : 'grid-cols-2');
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<form
			method="POST"
			action="?/createSession"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						const data = result.data as Record<string, string | undefined>;
						if (data?.error) {
							console.error('Session creation failed:', data.error);
						} else {
							await update({ reset: false });
							open = false;
							onSuccess();
						}
					}
				};
			}}
		>
			<input type="hidden" name="worktreePath" value={worktreePath ?? ''} />

			<Dialog.Header>
				<Dialog.Title>Select CLI Tool</Dialog.Title>
				<Dialog.Description>Choose a CLI tool to start your session</Dialog.Description>
			</Dialog.Header>

			<div class="py-4">
				<div class="grid {gridCols} gap-3">
					{#each cards as card (card.id)}
						{#if 'isAddCard' in card && card.isAddCard}
							<!-- Add card - does not submit form -->
							<button type="button" class="group w-full" onclick={() => onEdit(undefined)}>
								<Card
									class={cn(
										'flex w-full flex-col items-center justify-center transition-colors',
										'hover:ring-1 hover:ring-foreground/20'
									)}
								>
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
								</Card>
							</button>
						{:else}
							<!-- Profile card - submits form with cliProfileId -->
							<div class="group relative w-full">
								<button type="submit" name="cliProfileId" value={card.id} class="w-full">
									<Card
										class={cn(
											'flex w-full flex-col items-center justify-center transition-colors',
											'hover:ring-1 hover:ring-foreground/20'
										)}
									>
										<CardContent class="flex flex-col items-center justify-center gap-1 py-5">
											<span class="text-xs font-medium">
												{(card as CliProfile).name}
											</span>
											<span class="text-[10px] text-muted-foreground">
												{(card as CliProfile).command}
											</span>
										</CardContent>
									</Card>
								</button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									class="absolute top-1 right-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
									onclick={(e) => {
										e.stopPropagation();
										onEdit(card as CliProfile);
									}}
									aria-label="Edit {(card as CliProfile).name} profile"
								>
									<Settings class="size-3.5" />
								</Button>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
