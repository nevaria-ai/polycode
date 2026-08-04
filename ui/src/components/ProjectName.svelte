<script lang="ts" module>
	/**
	 * Returns the `owner/` prefix to mute when `displayName` is the git
	 * `owner/repo` form (i.e. owner is set and displayName starts with it).
	 * Returns null for plain folders or display names demoted by collision
	 * (e.g. `parent/folder` — owner is set but displayName no longer matches).
	 */
	export function getOwnerPrefix(owner: string | null, displayName: string): string | null {
		if (owner === null) return null;
		const prefix = `${owner}/`;
		return displayName.startsWith(prefix) ? prefix : null;
	}
</script>

<script lang="ts">
	interface Props {
		displayName: string;
		owner?: string | null;
		class?: string;
	}

	let { displayName, owner = null, class: className }: Props = $props();

	// Lazily compute the muted prefix; null means "render plainly".
	let prefix = $derived(getOwnerPrefix(owner, displayName));
	let repo = $derived(prefix ? displayName.slice(prefix.length) : null);
</script>

{#if prefix && repo !== null}
	<span class={className}>
		<!-- Opacity (not a color token) so the prefix inherits the parent text
		     color — including sidebar hover accent — and stays slightly dimmer. -->
		<span class="opacity-65">{prefix}</span><span class="opacity-100">{repo}</span>
	</span>
{:else}
	<span class={className}>{displayName}</span>
{/if}
