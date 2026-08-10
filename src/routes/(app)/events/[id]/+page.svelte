<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { ROLE_LABELS } from '$lib/roles';
	import PartySocket from 'partysocket';
	import { PUBLIC_PARTYKIT_HOST } from '$env/static/public';
	import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlankIcon';
	import MapPinIcon from 'phosphor-svelte/lib/MapPinIcon';
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import QuestionIcon from 'phosphor-svelte/lib/QuestionIcon';
	import XCircleIcon from 'phosphor-svelte/lib/XCircleIcon';
	import ClockCountdownIcon from 'phosphor-svelte/lib/ClockCountdownIcon';
	import TicketIcon from 'phosphor-svelte/lib/TicketIcon';
	import QrCodeIcon from 'phosphor-svelte/lib/QrCodeIcon';
	import PaperPlaneTiltIcon from 'phosphor-svelte/lib/PaperPlaneTiltIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';

	let { data } = $props();

	interface InviteResult {
		status?: 'added' | 'pending';
		error?: string;
	}

	interface RsvpResult {
		status?: 'going' | 'maybe' | 'declined' | 'waitlisted';
		error?: string;
	}

	let inviteUsername = $state('');
	let inviteRole = $state<'coorganizer' | 'attendee'>('attendee');
	let inviteStatus = $state('');
	let inviteLoading = $state(false);

	// seeded once from load(), then owned locally by setRsvp — not meant to reset on invalidateAll()
	let rsvpStatus = $state(data.myRsvpStatus);
	let rsvpNotes = $state('');
	let rsvpLoading = $state(false);
	let liveCount = $state<number | null>(null);

	let editOpen = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let editDate = $state('');
	let editLocation = $state('');
	let editCapacity = $state('');
	let editStatus = $state('');
	let editLoading = $state(false);

	function openEdit() {
		editTitle = data.event.title;
		editDescription = data.event.description;
		editDate = data.event.date;
		editLocation = data.event.location;
		editCapacity = data.event.capacity === null ? '' : String(data.event.capacity);
		editStatus = '';
		editOpen = true;
	}

	async function handleSaveEdit() {
		editStatus = '';
		if (!editTitle.trim()) {
			editStatus = 'Title is required';
			return;
		}
		editLoading = true;
		try {
			const res = await fetch(`/api/events/${data.event.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: editTitle,
					description: editDescription,
					date: editDate,
					location: editLocation,
					capacity: editCapacity ? Number(editCapacity) : null
				})
			});
			if (!res.ok) {
				const result: { error?: string } = await res.json();
				editStatus = result.error ?? 'Could not save changes';
				return;
			}
			editOpen = false;
			await invalidateAll();
		} catch {
			editStatus = 'Something went wrong';
		} finally {
			editLoading = false;
		}
	}

	let shareLoading = $state(false);
	let shareCopied = $state(false);
	let shareUrl = $derived(`${page.url.origin}/join/${data.event.inviteToken}`);

	async function toggleShareLink() {
		shareLoading = true;
		try {
			const res = await fetch(`/api/events/${data.event.id}/share-link`, {
				method: data.event.inviteToken ? 'DELETE' : 'POST'
			});
			if (res.ok) await invalidateAll();
		} finally {
			shareLoading = false;
		}
	}

	async function copyShareLink() {
		if (!data.event.inviteToken) return;
		await navigator.clipboard.writeText(shareUrl);
		shareCopied = true;
		setTimeout(() => (shareCopied = false), 2000);
	}

	async function handleCancelEvent() {
		if (!confirm('Cancel this event? Everyone who RSVPed will be notified.')) return;
		const res = await fetch(`/api/events/${data.event.id}`, { method: 'DELETE' });
		if (res.ok) await invalidateAll();
	}

	$effect(() => {
		const socket = new PartySocket({ host: PUBLIC_PARTYKIT_HOST, room: data.event.id });
		socket.addEventListener('message', (e) => {
			const msg = JSON.parse(e.data);
			if (msg.type === 'count') liveCount = msg.count;
		});
		return () => socket.close();
	});

	async function handleInvite() {
		inviteStatus = '';
		inviteLoading = true;
		try {
			const res = await fetch(`/api/events/${data.event.id}/invites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ telegramUsername: inviteUsername, role: inviteRole })
			});

			const result: InviteResult = await res.json();
			if (!res.ok) {
				inviteStatus = result.error ?? 'Failed to invite';
			} else {
				inviteStatus = result.status === 'added' ? "They're in — we let them know." : "Invite saved — we'll add them as soon as they join.";
				inviteUsername = '';
				await invalidateAll();
			}
		} catch {
			inviteStatus = 'Something went wrong';
		} finally {
			inviteLoading = false;
		}
	}

	async function setRsvp(status: 'going' | 'maybe' | 'declined') {
		rsvpLoading = true;
		try {
			const res = await fetch(`/api/events/${data.event.id}/rsvp`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status, notes: rsvpNotes.trim() || undefined })
			});

			const result: RsvpResult = await res.json();
			if (res.ok && result.status) rsvpStatus = result.status;
		} finally {
			rsvpLoading = false;
		}
	}
</script>

<svelte:head><title>{data.event.title} · Evt</title></svelte:head>

<div class="mx-auto mt-8 max-w-md space-y-4">
	{#if data.event.cancelled}
		<div class="glass rounded-2xl border border-red-200 p-4 text-center">
			<p class="text-sm font-medium text-red-700">This event was cancelled.</p>
		</div>
	{/if}

	<div class="glass rounded-2xl p-6">
		<h1 class="mb-3 text-xl font-semibold text-neutral-900">{data.event.title}</h1>
		<div class="space-y-1.5 text-sm text-neutral-600">
			{#if data.event.date}
				<p class="flex items-center gap-2">
					<CalendarBlankIcon size={16} />{data.event.date}
					<a href="/events/{data.event.id}/calendar.ics" class="text-xs font-medium text-accent-700 hover:underline">
						Add to calendar
					</a>
				</p>
			{/if}
			{#if data.event.location}
				<p class="flex items-center gap-2"><MapPinIcon size={16} />{data.event.location}</p>
			{/if}
			{#if liveCount !== null}
				<p class="flex items-center gap-2"><UsersIcon size={16} />{liveCount} going</p>
			{/if}
		</div>
		{#if data.event.description}<p class="mt-3 text-sm text-neutral-700">{data.event.description}</p>{/if}
	</div>

	{#if !data.event.cancelled}
	<div class="glass rounded-2xl p-6">
		<h2 class="mb-3 text-sm font-medium text-neutral-700">Your RSVP</h2>
		<div class="flex gap-2">
			<button
				onclick={() => setRsvp('going')}
				disabled={rsvpLoading}
				class={rsvpStatus === 'going' ? 'btn-accent flex-1' : 'btn-outline flex-1'}
			>
				<CheckCircleIcon size={16} weight={rsvpStatus === 'going' ? 'fill' : 'regular'} />
				Going
			</button>
			<button
				onclick={() => setRsvp('maybe')}
				disabled={rsvpLoading}
				class={rsvpStatus === 'maybe' ? 'btn-accent flex-1' : 'btn-outline flex-1'}
			>
				<QuestionIcon size={16} weight={rsvpStatus === 'maybe' ? 'fill' : 'regular'} />
				Maybe
			</button>
			<button
				onclick={() => setRsvp('declined')}
				disabled={rsvpLoading}
				class={rsvpStatus === 'declined' ? 'btn-accent flex-1' : 'btn-outline flex-1'}
			>
				<XCircleIcon size={16} weight={rsvpStatus === 'declined' ? 'fill' : 'regular'} />
				Can't go
			</button>
		</div>
		{#if rsvpStatus === 'waitlisted'}
			<p class="mt-3 flex items-center gap-2 text-sm text-amber-600">
				<ClockCountdownIcon size={16} />
				You're on the waitlist — we'll let you know if a spot opens up.
			</p>
		{/if}
		{#if rsvpStatus === 'going'}
			<a href="/events/{data.event.id}/ticket" class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent-700 hover:underline">
				<TicketIcon size={16} weight="fill" />
				View your ticket
			</a>
		{/if}
		<label for="rsvp-notes" class="field-label mt-4">Notes (optional)</label>
		<textarea
			id="rsvp-notes"
			bind:value={rsvpNotes}
			placeholder="Dietary restrictions, plus-ones, etc."
			class="field-input"
		></textarea>
	</div>
	{/if}

	<div class="glass rounded-2xl p-6">
		<h2 class="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-700">
			<UsersIcon size={16} />
			Guests
		</h2>
		<ul class="space-y-1 text-sm">
			{#each data.members as member (member.userId)}
				<li class="flex items-center justify-between">
					<span>{member.firstName ?? member.username ?? member.userId}</span>
					<span class="text-xs text-neutral-500">{ROLE_LABELS[member.role]}</span>
				</li>
			{/each}
		</ul>
	</div>

	{#if data.isManager && !data.event.cancelled}
		<a href="/events/{data.event.id}/scan" class="btn-outline w-full">
			<QrCodeIcon size={16} />
			Scan tickets
		</a>

		<div class="glass rounded-2xl p-6">
			<div class="flex items-center justify-between">
				<h2 class="flex items-center gap-2 text-sm font-medium text-neutral-700">
					<PencilSimpleIcon size={16} />
					Edit event
				</h2>
				<button onclick={() => (editOpen ? (editOpen = false) : openEdit())} class="btn-outline px-2.5 py-1 text-xs">
					{editOpen ? 'Close' : 'Edit'}
				</button>
			</div>
			{#if editOpen}
				<form onsubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} class="mt-4">
					<label for="edit-title" class="field-label">Title</label>
					<input id="edit-title" type="text" bind:value={editTitle} class="field-input mb-3" />

					<label for="edit-description" class="field-label">Description</label>
					<textarea id="edit-description" bind:value={editDescription} class="field-input mb-3"></textarea>

					<label for="edit-date" class="field-label">Date</label>
					<input id="edit-date" type="datetime-local" bind:value={editDate} class="field-input mb-3" />

					<label for="edit-location" class="field-label">Location</label>
					<input id="edit-location" type="text" bind:value={editLocation} class="field-input mb-3" />

					<label for="edit-capacity" class="field-label">Capacity (optional)</label>
					<input id="edit-capacity" type="number" min="1" bind:value={editCapacity} placeholder="Unlimited" class="field-input mb-3" />

					{#if editStatus}
						<p class="mb-3 text-sm text-red-600">{editStatus}</p>
					{/if}

					<button type="submit" disabled={editLoading} class="btn-primary w-full">
						{editLoading ? 'Saving…' : 'Save changes'}
					</button>
				</form>
			{/if}
		</div>

		<div class="glass rounded-2xl p-6">
			<h2 class="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-700">
				<PaperPlaneTiltIcon size={16} />
				Invite a guest
			</h2>
			<form onsubmit={(e) => { e.preventDefault(); handleInvite(); }} class="flex gap-2">
				<input
					type="text"
					bind:value={inviteUsername}
					placeholder="Telegram username"
					class="field-input flex-1"
				/>
				<select bind:value={inviteRole} class="field-input w-auto">
					<option value="attendee">Guest</option>
					<option value="coorganizer">Co-host</option>
				</select>
				<button type="submit" disabled={inviteLoading} class="btn-primary">Invite</button>
			</form>
			{#if inviteStatus}
				<p class="mt-2 text-sm text-neutral-600">{inviteStatus}</p>
			{/if}
		</div>

		{#if data.pendingInvites.length > 0}
			<div class="glass rounded-2xl p-6">
				<h2 class="mb-3 text-sm font-medium text-neutral-700">Pending invites</h2>
				<div class="space-y-2">
					{#each data.pendingInvites as invite (invite.id)}
						<div class="flex items-center justify-between rounded-lg border border-neutral-200 bg-white/50 p-2.5 text-sm">
							<span>@{invite.telegramUsername} · {ROLE_LABELS[invite.role]}</span>
							<span class="flex items-center gap-1 text-xs text-neutral-400">
								<ClockIcon size={14} />
								We'll add them when they join
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="glass rounded-2xl p-6">
			<h2 class="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-700">
				<LinkIcon size={16} />
				Share link
			</h2>
			{#if data.event.inviteToken}
				<p class="mb-3 truncate rounded-lg border border-neutral-200 bg-white/50 p-2.5 text-xs text-neutral-600">
					{shareUrl}
				</p>
				<div class="flex gap-2">
					<button onclick={copyShareLink} class="btn-primary flex-1">
						{shareCopied ? 'Copied!' : 'Copy link'}
					</button>
					<button onclick={toggleShareLink} disabled={shareLoading} class="btn-outline">Turn off</button>
				</div>
			{:else}
				<p class="mb-3 text-sm text-neutral-600">Anyone with the link can join as a guest.</p>
				<button onclick={toggleShareLink} disabled={shareLoading} class="btn-outline w-full">
					Create share link
				</button>
			{/if}
		</div>

		<button onclick={handleCancelEvent} class="btn-outline w-full text-red-600">
			Cancel event
		</button>
	{/if}
</div>
