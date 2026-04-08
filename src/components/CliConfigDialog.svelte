<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import * as Dialog from '$components/ui/dialog';
	import { Plus, Trash2 } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import type { CliProfile } from '$lib/cli-profiles';

	let {
		open = $bindable(false),
		profile = $bindable(null as CliProfile | null),
		onsaved
	}: {
		open?: boolean;
		profile?: CliProfile | null;
		onsaved?: (profile: CliProfile) => void;
	} = $props();

	let name = $state('');
	let command = $state('');
	let argsStr = $state('');
	let envEntries = $state<{ key: string; value: string }[]>([]);
	let saving = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (open) {
			if (profile) {
				name = profile.name;
				command = profile.command;
				argsStr = profile.args.join(', ');
				envEntries = Object.entries(profile.env).map(([key, value]) => ({ key, value }));
			} else {
				name = '';
				command = '';
				argsStr = '';
				envEntries = [];
			}
			error = null;
		}
	});

	function addEnvVar() {
		envEntries = [...envEntries, { key: '', value: '' }];
	}

	function removeEnvVar(index: number) {
		envEntries = envEntries.filter((_, i) => i !== index);
	}

	function updateEnvKey(index: number, value: string) {
		envEntries = envEntries.map((entry, i) => (i === index ? { ...entry, key: value } : entry));
	}

	function updateEnvValue(index: number, value: string) {
		envEntries = envEntries.map((entry, i) => (i === index ? { ...entry, value: value } : entry));
	}

	function buildEnvJson(): string {
		const env: Record<string, string> = {};
		for (const entry of envEntries) {
			if (entry.key.trim()) {
				env[entry.key.trim()] = entry.value;
			}
		}
		return JSON.stringify(env);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{profile ? 'Edit CLI Profile' : 'Add CLI Profile'}</Dialog.Title>
			<Dialog.Description>
				{profile
					? 'Update the CLI configuration settings'
					: 'Configure a new CLI profile for your sessions'}
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="/?/saveCliProfile"
			use:enhance={() => {
				saving = true;
				return async ({ result, update }) => {
					saving = false;
					if (result.type === 'success') {
						const data = result.data as Record<string, string | undefined>;
						if (data?.error) {
							error = data.error;
						} else {
							await update({ reset: false });
							open = false;
							onsaved?.(profile!);
						}
					}
				};
			}}
		>
			<div class="grid gap-4 py-4">
				{#if error}
					<div class="rounded-sm bg-destructive/10 px-3 py-2 text-xs text-destructive">
						{error}
					</div>
				{/if}

				<input type="hidden" name="id" value={profile?.id ?? ''} />
				<input type="hidden" name="predefined" value={profile?.predefined ? 'true' : 'false'} />
				<input type="hidden" name="args" value={argsStr} />
				<input type="hidden" name="env" value={buildEnvJson()} />

				<div class="grid gap-2">
					<label for="cli-name" class="text-xs font-medium">Name</label>
					<Input
						bind:value={name}
						id="cli-name"
						name="name"
						placeholder="e.g. Claude, GPT-4, Local LLM"
						required
						disabled={saving}
					/>
				</div>

				<div class="grid gap-2">
					<label for="cli-command" class="text-xs font-medium">Command</label>
					<Input
						bind:value={command}
						id="cli-command"
						name="command"
						placeholder="e.g. claude, python, node"
						required
						disabled={saving}
					/>
				</div>

				<div class="grid gap-2">
					<label for="cli-args" class="text-xs font-medium">Arguments</label>
					<Input
						bind:value={argsStr}
						id="cli-args"
						placeholder="e.g. --model claude-3-opus, --verbose"
						disabled={saving}
					/>
					<p class="text-xs text-muted-foreground">Separate multiple arguments with commas</p>
				</div>

				<div class="grid gap-2">
					<span class="text-xs font-medium">Environment Variables</span>
					<div class="grid gap-2">
						{#each envEntries as entry, index (index)}
							<div class="flex gap-2">
								<Input
									bind:value={entry.key}
									placeholder="KEY"
									oninput={(e) => updateEnvKey(index, e.currentTarget.value)}
									disabled={saving}
									class="flex-1"
								/>
								<span class="flex items-center text-xs text-muted-foreground">=</span>
								<Input
									bind:value={entry.value}
									placeholder="value"
									oninput={(e) => updateEnvValue(index, e.currentTarget.value)}
									disabled={saving}
									class="flex-1"
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onclick={() => removeEnvVar(index)}
									disabled={saving}
								>
									<Trash2 class="size-4" />
								</Button>
							</div>
						{/each}
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={addEnvVar}
						disabled={saving}
						class="mt-2"
					>
						<Plus class="mr-2 size-4" />
						Add variable
					</Button>
				</div>
			</div>

			<Dialog.Footer>
				{#if profile}
					<form
						method="POST"
						action="/?/deleteCliProfile"
						use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'success') {
									const data = result.data as Record<string, string | undefined>;
									if (data?.error) {
										error = data.error;
									} else {
										await update({ reset: false });
										open = false;
										onsaved?.(profile);
									}
								}
							};
						}}
						class="mr-auto"
					>
						<input type="hidden" name="id" value={profile.id} />
						<Button type="submit" variant="destructive" size="sm" disabled={saving}>
							<Trash2 class="mr-1.5 size-3.5" />
							Delete
						</Button>
					</form>
				{/if}
				<Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>
					Cancel
				</Button>
				<Button type="submit" disabled={saving || !name.trim() || !command.trim()}>
					{saving ? 'Saving...' : profile ? 'Update' : 'Add'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
