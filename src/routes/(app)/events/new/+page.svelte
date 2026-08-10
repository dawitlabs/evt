<script lang="ts">
	import { goto } from '$app/navigation';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';

	let title = $state('');
	let description = $state('');
	let date = $state('');
	let location = $state('');
	let capacity = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleCreate() {
		error = '';

		if (!title.trim()) {
			error = 'Title is required';
			return;
		}

		loading = true;

		try {
			const res = await fetch('/api/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title,
					description,
					date,
					location,
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

<div class="mx-auto mt-8 max-w-md">
	<div class="glass rounded-2xl p-6">
		<h1 class="mb-6 text-xl font-semibold text-neutral-900">New event</h1>

		<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
			<label for="title" class="field-label">Title</label>
			<input id="title" type="text" bind:value={title} class="field-input mb-3" />

			<label for="description" class="field-label">Description</label>
			<textarea id="description" bind:value={description} class="field-input mb-3"></textarea>

			<label for="date" class="field-label">Date</label>
			<input id="date" type="datetime-local" bind:value={date} class="field-input mb-3" />

			<label for="location" class="field-label">Location</label>
			<input id="location" type="text" bind:value={location} class="field-input mb-3" />

			<label for="capacity" class="field-label">Capacity (optional)</label>
			<input
				id="capacity"
				type="number"
				min="1"
				bind:value={capacity}
				placeholder="Unlimited"
				class="field-input mb-3"
			/>

			{#if error}
				<p class="mb-3 flex items-center gap-2 text-sm text-red-600">
					<WarningCircleIcon size={16} />
					{error}
				</p>
			{/if}

			<button type="submit" disabled={loading} class="btn-primary w-full">
				{loading ? 'Creating…' : 'Create event'}
			</button>
		</form>
	</div>
</div>
