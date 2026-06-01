<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { replaceState, invalidateAll } from '$app/navigation';
	import { sendMessage, updateSessionTitle } from '$lib/services';
	import { Pin, FileText, Bot, User, Pencil } from '@lucide/svelte';
	import PromptPanel from '$components/PromptPanel.svelte';
	import { tick } from 'svelte';

	let { data } = $props<{ data: PageData }>();

	let messageText = $state('');
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let consumedInitSubmit = $state(false);

	let isEditingTitle = $state(false);
	let editTitle = $state('');
	let renameError = $state<string | null>(null);
	let renameInput = $state<HTMLInputElement | null>(null);

	const session = $derived(data.session);
	const messages = $derived(data.messages);
	const pinnedContext = $derived(data.pinnedContext);
	const hasSummary = $derived(data.hasSummary);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const _providerRuns = $derived(data.providerRuns);

	const displayTitle = $derived(session?.title ?? `Session ${session?.id.slice(0, 8) ?? ''}`);

	// Sort messages by position ascending for display
	const sortedMessages = $derived([...messages].sort((a, b) => a.position - b.position));

	// Consume one-time init state from homepage handoff
	$effect(() => {
		const init = page.state.initSessionFields;
		if (!init || consumedInitSubmit || !session) return;

		consumedInitSubmit = true;
		replaceState(page.url, { ...page.state, initSessionFields: null });
		void submitPrompt(init.prompt);
	});

	async function submitPrompt(content: string) {
		if (!session) return;

		submitting = true;
		submitError = null;

		try {
			await sendMessage(session.projectId, session.id, {
				content
			});
			messageText = '';
			await invalidateAll();
		} catch (err: any) {
			submitError = err?.message ?? 'Failed to send message';
		}

		submitting = false;
	}

	async function handleSubmit() {
		if (!messageText.trim() || !session) return;
		void submitPrompt(messageText.trim());
	}

	async function startRename() {
		if (!session) return;
		editTitle = displayTitle;
		isEditingTitle = true;
		renameError = null;
		await tick();
		renameInput?.focus();
		renameInput?.select();
	}

	async function finishRename() {
		if (!session || !editTitle.trim()) {
			isEditingTitle = false;
			return;
		}

		try {
			await updateSessionTitle(session.projectId, session.id, {
				title: editTitle.trim()
			});
			isEditingTitle = false;
			await invalidateAll();
		} catch (err: any) {
			renameError = err?.message ?? 'Failed to rename session';
		}
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			finishRename();
		} else if (e.key === 'Escape') {
			isEditingTitle = false;
		}
	}

	function getRoleLabel(role: string) {
		return role === 'user' ? 'You' : role === 'assistant' ? 'Assistant' : 'System';
	}

	function getPartContent(part: { type: string; content: string }): string {
		// For text parts, return content directly
		// For other parts, could format differently
		return part.content;
	}
</script>

{#if session}
	<div class="flex h-full flex-col">
		<div class="flex items-center gap-3 border-b border-white/8 px-6 py-3">
			{#if isEditingTitle}
				<input
					bind:this={renameInput}
					type="text"
					bind:value={editTitle}
					onblur={finishRename}
					onkeydown={handleRenameKeydown}
					class="flex-1 rounded bg-transparent px-2 py-1 text-sm font-medium text-zinc-200 ring-1 ring-white/20 outline-none"
				/>
				{#if renameError}
					<span class="text-xs text-red-400">{renameError}</span>
				{/if}
			{:else}
				<h1 class="flex-1 text-sm font-medium text-zinc-200">{displayTitle}</h1>
				<button
					type="button"
					onclick={startRename}
					class="flex size-6 cursor-pointer items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/6 hover:text-zinc-200"
					aria-label="Rename session"
				>
					<Pencil class="size-3.5" />
				</button>
			{/if}
		</div>

		{#if hasSummary}
			<div class="flex items-center gap-2 border-b border-white/8 bg-blue-500/5 px-6 py-2">
				<FileText class="size-3.5 text-blue-400" />
				<span class="text-xs text-blue-400">Session has been compacted (summary available)</span>
			</div>
		{/if}

		{#if pinnedContext.length > 0}
			<div class="flex items-center gap-2 border-b border-white/8 bg-white/3 px-6 py-2">
				<Pin class="size-3.5 shrink-0 text-zinc-400" />
				<span class="text-xs text-zinc-400">Pinned:</span>
				<div class="flex flex-wrap gap-1.5">
					{#each pinnedContext as item (item.id)}
						<span class="rounded bg-white/8 px-2 py-0.5 text-xs text-zinc-300">
							{item.resolvedPath ?? item.source}
						</span>
					{/each}
				</div>
			</div>
		{/if}

		<div class="flex-1 overflow-y-auto px-6 py-4">
			{#if sortedMessages.length === 0}
				<div class="flex h-full items-center justify-center">
					<p class="text-sm text-zinc-500">No messages yet. Start the conversation below.</p>
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					{#each sortedMessages as message (message.id)}
						<div class="flex gap-3">
							<div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/6">
								{#if message.role === 'user'}
									<User class="size-3.5 text-zinc-400" />
								{:else if message.role === 'assistant'}
									<Bot class="size-3.5 text-zinc-400" />
								{:else}
									<User class="size-3.5 text-zinc-400" />
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<div class="mb-1 text-xs font-medium text-zinc-400">
									{getRoleLabel(message.role)}
								</div>
								{#if message.parts && message.parts.length > 0}
									<div class="flex flex-col gap-2">
										{#each message.parts as part (part.id)}
											<div class="text-sm whitespace-pre-wrap text-zinc-200">
												{getPartContent(part)}
											</div>
										{/each}
									</div>
								{:else}
									<div class="text-sm whitespace-pre-wrap text-zinc-200">
										{message.content}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if session.status === 'active'}
			<div class="border-t border-white/8 px-6 py-4">
				{#if submitError}
					<p class="mb-2 text-xs text-red-400">{submitError}</p>
				{/if}
				<PromptPanel
					bind:value={messageText}
					placeholder="Type a message..."
					disabled={submitting}
					onsubmit={handleSubmit}
				/>
			</div>
		{:else}
			<div class="border-t border-white/8 px-6 py-3">
				<p class="text-xs text-zinc-500">
					This session is {session.status === 'archived' ? 'archived' : 'ended'}. New messages
					cannot be sent.
				</p>
			</div>
		{/if}
	</div>
{:else}
	<section class="flex h-full items-center justify-center p-8">
		<div class="max-w-md rounded-2xl border border-white/8 bg-white/3 p-8 text-center">
			<p class="text-sm text-zinc-400">Session not found or you do not have access.</p>
		</div>
	</section>
{/if}
