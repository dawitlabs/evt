<script lang="ts">
	import { goto } from '$app/navigation';
	import { getUnlockedKey } from '$lib/crypto/session.svelte';
	import { generateEventKey, encryptEventData, sealEventKeyFor } from '$lib/crypto/eventKey';
	import UnlockPassphraseModal from '$lib/components/UnlockPassphraseModal.svelte';

	let title = $state('');
	let description = $state('');
	let date = $state('');
	let location = $state('');
	let capacity = $state('');
	let error = $state('');
	let loading = $state(false);
	let unlockOpen = $state(false);

	async function handleCreate() {
		error = '';

		if (!title.trim()) {
			error = 'Title is required';
			return;
		}

		const unlocked = getUnlockedKey();
		if (!unlocked) {
			unlockOpen = true;
			return;
		}

		loading = true;

		try {
			const eventKey = await generateEventKey();
			const payload = await encryptEventData({ title, description, date, location }, eventKey);
			const wrappedKey = await sealEventKeyFor(eventKey, unlocked.publicKey);

			const res = await fetch('/api/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...payload,
					wrappedKey,
					capacity: capacity ? Number(capacity) : undefined
				})
			});

			if (!res.ok) throw new Error('Failed to create event');

			const result = await res.json();
			goto(`/events/${result.id}`);
		} catch {
			error = 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="mx-auto mt-16 max-w-md">
	<h1 class="mb-6 text-xl font-semibold">New event</h1>

	<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
		<label for="title" class="mb-1 block text-sm font-medium">Title</label>
		<input id="title" type="text" bind:value={title} class="mb-3 w-full rounded border p-2" />

		<label for="description" class="mb-1 block text-sm font-medium">Description</label>
		<textarea id="description" bind:value={description} class="mb-3 w-full rounded border p-2"></textarea>

		<label for="date" class="mb-1 block text-sm font-medium">Date</label>
		<input id="date" type="datetime-local" bind:value={date} class="mb-3 w-full rounded border p-2" />

		<label for="location" class="mb-1 block text-sm font-medium">Location</label>
		<input id="location" type="text" bind:value={location} class="mb-3 w-full rounded border p-2" />

		<label for="capacity" class="mb-1 block text-sm font-medium">Capacity (optional)</label>
		<input
			id="capacity"
			type="number"
			min="1"
			bind:value={capacity}
			placeholder="Unlimited"
			class="mb-3 w-full rounded border p-2"
		/>

		{#if error}
			<p class="mb-3 text-sm text-red-600">{error}</p>
		{/if}

		<button type="submit" disabled={loading} class="w-full rounded bg-black p-2 text-white">
			{loading ? 'Creating…' : 'Create event'}
		</button>
	</form>
</div>

<UnlockPassphraseModal bind:open={unlockOpen} onUnlocked={handleCreate} />
