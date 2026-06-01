<script lang="ts">
	import { ArrowUp, Plus } from '@lucide/svelte';
	import * as InputGroup from '$components/ui/input-group';

	let {
		value = $bindable(''),
		placeholder = 'Enter your query!',
		disabled = false,
		onsubmit
	}: {
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		onsubmit?: () => void | Promise<void>;
	} = $props();

	let isSendButtonDisabled = $derived(disabled || value.trim() === '');
</script>

<InputGroup.Root
	data-testid="prompt-panel"
	class="rounded-2xl border-white/10 opacity-100! shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm has-[>[data-align=block-end]]:min-h-0"
>
	<InputGroup.Textarea
		bind:value
		onkeydown={(event: KeyboardEvent) => {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				void onsubmit?.();
			}
		}}
		{placeholder}
		{disabled}
		class="custom-scrollbar max-h-32 min-h-0 overflow-y-auto p-4 pb-3"
	/>

	<InputGroup.Addon
		data-testid="prompt-panel-footer"
		align="block-end"
		class="justify-between gap-2 border-none p-2"
	>
		<div class="flex items-center gap-2">
			<InputGroup.Button
				data-testid="prompt-panel-attach"
				variant="ghost"
				size="icon-sm"
				class="rounded-full"
				onclick={() => console.log('Attach file')}
			>
				<Plus class="size-4" />
			</InputGroup.Button>
		</div>

		<div class="flex items-center gap-2">
			<InputGroup.Button
				data-testid="prompt-panel-send"
				variant="default"
				size="icon-sm"
				class="rounded-full"
				disabled={isSendButtonDisabled}
				onclick={() => void onsubmit?.()}
			>
				<ArrowUp class="size-4" />
			</InputGroup.Button>
		</div>
	</InputGroup.Addon>
</InputGroup.Root>
