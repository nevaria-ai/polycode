<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";
	import TooltipProvider from "./tooltip-provider.svelte";

	let {
		open = $bindable(false),
		delayDuration = 0,
		...restProps
	}: TooltipPrimitive.RootProps & { delayDuration?: number } = $props();
</script>

<TooltipProvider {delayDuration}>
	<TooltipPrimitive.Root bind:open {...restProps} />
</TooltipProvider>
