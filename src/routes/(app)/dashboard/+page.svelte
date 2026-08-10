<script lang="ts">
	import { ROLE_LABELS } from '$lib/roles';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlankIcon';

	let { data } = $props();
</script>

<svelte:head><title>Your events · Evt</title></svelte:head>

<div class="mx-auto mt-8 max-w-md">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-semibold text-neutral-900">Your events</h1>
		<a href="/events/new" class="btn-accent">
			<PlusIcon size={16} weight="bold" />
			New event
		</a>
	</div>

	{#if data.events.length === 0}
		<div class="glass rounded-2xl p-6 text-center">
			<CalendarBlankIcon size={24} class="mx-auto mb-2 text-neutral-400" />
			<p class="text-sm text-neutral-600">No events yet.</p>
		</div>
	{:else}
		<ul class="space-y-2">
			{#each data.events as event (event.eventId)}
				<li class="glass rounded-xl p-4 transition hover:bg-white/80">
					<a href="/events/{event.eventId}" class="font-medium text-neutral-900">{event.title}</a>
					<span class="ml-1 text-xs text-neutral-500">{ROLE_LABELS[event.role]}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
