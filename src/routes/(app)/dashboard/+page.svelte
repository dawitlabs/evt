<script lang="ts">
	import { getUnlockedKey } from '$lib/crypto/session.svelte';
	import { unsealEventKey, decryptEventData } from '$lib/crypto/eventKey';
	import UnlockPassphraseModal from '$lib/components/UnlockPassphraseModal.svelte';
	import LockKeyOpenIcon from 'phosphor-svelte/lib/LockKeyOpenIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlankIcon';
	import SpinnerIcon from 'phosphor-svelte/lib/SpinnerIcon';

	let { data } = $props();

	interface DecryptedEvent {
		eventId: string;
		title: string;
		role: string;
	}

	let unlockOpen = $state(false);
	let decrypted = $state<DecryptedEvent[] | null>(null);
	let decryptError = $state('');

	async function decryptAll() {
		const unlocked = getUnlockedKey();
		if (!unlocked) return;

		decryptError = '';

		try {
			decrypted = await Promise.all(
				data.events.map(async (row: (typeof data.events)[number]) => {
					const eventKey = await unsealEventKey(row.wrappedKey, unlocked.publicKey, unlocked.privateKey);
					const details = await decryptEventData<{ title: string }>(
						{ ciphertext: row.ciphertext, nonce: row.nonce },
						eventKey
					);
					return { eventId: row.eventId, title: details.title, role: row.role };
				})
			);
		} catch {
			decryptError = 'Could not decrypt your events.';
		}
	}

	$effect(() => {
		if (getUnlockedKey()) decryptAll();
	});
</script>

<div class="mx-auto mt-8 max-w-md">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-semibold text-neutral-900">Your events</h1>
		<a href="/events/new" class="btn-accent">
			<PlusIcon size={16} weight="bold" />
			New event
		</a>
	</div>

	{#if !getUnlockedKey()}
		<div class="glass rounded-2xl p-6 text-center">
			<p class="mb-3 text-sm text-neutral-600">Unlock your key to view your events.</p>
			<button onclick={() => (unlockOpen = true)} class="btn-primary">
				<LockKeyOpenIcon size={16} weight="fill" />
				Unlock
			</button>
		</div>
	{:else if decryptError}
		<p class="flex items-center gap-2 text-sm text-red-600">
			<WarningCircleIcon size={16} />
			{decryptError}
		</p>
	{:else if decrypted === null}
		<p class="flex items-center gap-2 text-sm text-neutral-500">
			<SpinnerIcon size={16} class="animate-spin" />
			Decrypting…
		</p>
	{:else if decrypted.length === 0}
		<div class="glass rounded-2xl p-6 text-center">
			<CalendarBlankIcon size={24} class="mx-auto mb-2 text-neutral-400" />
			<p class="text-sm text-neutral-600">No events yet.</p>
		</div>
	{:else}
		<ul class="space-y-2">
			{#each decrypted as event (event.eventId)}
				<li class="glass rounded-xl p-4 transition hover:bg-white/80">
					<a href="/events/{event.eventId}" class="font-medium text-neutral-900">{event.title}</a>
					<span class="ml-1 text-xs text-neutral-500">({event.role})</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<UnlockPassphraseModal bind:open={unlockOpen} onUnlocked={decryptAll} />
