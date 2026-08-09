<script lang="ts">
	import { getUnlockedKey } from '$lib/crypto/session.svelte';
	import { unsealEventKey, decryptEventData } from '$lib/crypto/eventKey';
	import UnlockPassphraseModal from '$lib/components/UnlockPassphraseModal.svelte';

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

<div class="mx-auto mt-16 max-w-md">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-semibold">Your events</h1>
		<a href="/events/new" class="text-sm underline">New event</a>
	</div>

	{#if !getUnlockedKey()}
		<p class="mb-3 text-sm text-gray-600">Unlock your key to view your events.</p>
		<button onclick={() => (unlockOpen = true)} class="rounded bg-black p-2 text-sm text-white">
			Unlock
		</button>
	{:else if decryptError}
		<p class="text-sm text-red-600">{decryptError}</p>
	{:else if decrypted === null}
		<p class="text-sm text-gray-600">Decrypting…</p>
	{:else if decrypted.length === 0}
		<p class="text-sm text-gray-600">No events yet.</p>
	{:else}
		<ul class="space-y-2">
			{#each decrypted as event (event.eventId)}
				<li class="rounded border p-3">
					<a href="/events/{event.eventId}" class="font-medium">{event.title}</a>
					<span class="text-xs text-gray-500">({event.role})</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<UnlockPassphraseModal bind:open={unlockOpen} onUnlocked={decryptAll} />
