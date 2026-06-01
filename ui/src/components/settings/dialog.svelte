<script lang="ts">
	import * as Dialog from '$components/ui/dialog';
	import * as Sidebar from '$components/ui/sidebar';
	import { Box } from '@lucide/svelte';

	type SettingsSection = 'models';

	let {
		open = $bindable(false)
	}: {
		open?: boolean;
	} = $props();

	let selectedSection = $state<SettingsSection>('models');
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		showCloseButton={false}
		class="h-[min(640px,80vh)] w-[calc(100%-2rem)] max-w-5xl! overflow-hidden p-0"
	>
		<Sidebar.Provider>
			<Sidebar.Root collapsible="none" class="h-full w-48 border-r px-1 py-3">
				<Sidebar.Content>
					<Sidebar.Group>
						<Sidebar.GroupContent>
							<Sidebar.Menu class="gap-1">
								<Sidebar.MenuItem>
									<Sidebar.MenuButton
										isActive={selectedSection === 'models'}
										onclick={() => (selectedSection = 'models')}
									>
										<Box class="size-4" />
										<span>Models</span>
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>
				</Sidebar.Content>
			</Sidebar.Root>

			<section class="flex-1 overflow-y-auto bg-background p-4">
				<h2 class="text-lg font-semibold">Models</h2>
				<p class="text-sm text-muted-foreground">Model settings are coming soon.</p>
			</section>
		</Sidebar.Provider>
	</Dialog.Content>
</Dialog.Root>
