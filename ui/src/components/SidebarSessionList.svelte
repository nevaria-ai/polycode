<script lang="ts">
	import * as Sidebar from '$components/ui/sidebar';

	export type SidebarSessionEntry = {
		id: string;
		title: string | null;
	};

	let {
		sessions = [],
		sessionHref,
		isSessionActive
	}: {
		sessions: SidebarSessionEntry[];
		sessionHref: (id: string) => string;
		isSessionActive: (id: string) => boolean;
	} = $props();

	const NOTREAL_ID = '__notreal__';
</script>

<ul class="flex flex-col gap-1">
	{#each sessions as session (session.id)}
		<li>
			{#if session.id === NOTREAL_ID}
				<span
					class="sidebar-session-link pointer-events-none ml-5 flex h-auto items-start gap-1 px-2 py-1 text-xs text-sidebar-foreground/30"
				>
					<span aria-hidden="true">•</span>
					<span>{session.title ?? 'Untitled session'}</span>
				</span>
			{:else}
				<Sidebar.MenuSubButton
					href={sessionHref(session.id)}
					isActive={isSessionActive(session.id)}
					class="sidebar-session-link ml-5 h-auto items-start gap-1"
				>
					<span class="sidebar-session-status" aria-hidden="true">•</span>
					<span>{session.title ?? 'Untitled session'}</span>
				</Sidebar.MenuSubButton>
			{/if}
		</li>
	{/each}
</ul>
