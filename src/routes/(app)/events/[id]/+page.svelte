<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getUnlockedKey } from '$lib/crypto/session.svelte';
	import { unsealEventKey, sealEventKeyFor, decryptEventData, encryptEventData } from '$lib/crypto/eventKey';
	import UnlockPassphraseModal from '$lib/components/UnlockPassphraseModal.svelte';
	import PartySocket from 'partysocket';
	import { PUBLIC_PARTYKIT_HOST } from '$env/static/public';
	import LockKeyOpenIcon from 'phosphor-svelte/lib/LockKeyOpenIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import SpinnerIcon from 'phosphor-svelte/lib/SpinnerIcon';
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

	let { data } = $props();

	interface EventDetails {
		title: string;
		description: string;
		date: string;
		location: string;
	}

	interface LookupResult {
		found: boolean;
		hasPublicKey: boolean;
		publicKey: string | null;
	}

	interface InviteResult {
		status?: 'added' | 'pending';
		error?: string;
	}

	interface RsvpResult {
		status?: 'going' | 'maybe' | 'declined' | 'waitlisted';
		error?: string;
	}

	let unlockOpen = $state(false);
	let eventKey = $state<Uint8Array | null>(null);
	let details = $state<EventDetails | null>(null);
	let decryptError = $state('');

	let inviteUsername = $state('');
	let inviteRole = $state<'coorganizer' | 'attendee'>('attendee');
	let inviteStatus = $state('');
	let inviteLoading = $state(false);
	let resolvingId = $state<string | null>(null);

	// seeded once from load(), then owned locally by setRsvp — not meant to reset on invalidateAll()
	let rsvpStatus = $state(data.myRsvpStatus);
	let rsvpNotes = $state('');
	let rsvpLoading = $state(false);
	let liveCount = $state<number | null>(null);

	async function decrypt() {
		const unlocked = getUnlockedKey();
		if (!unlocked) return;

		decryptError = '';
		try {
			eventKey = await unsealEventKey(data.membership.wrappedKey, unlocked.publicKey, unlocked.privateKey);
			details = await decryptEventData<EventDetails>(
				{ ciphertext: data.event.ciphertext, nonce: data.event.nonce },
				eventKey
			);
		} catch {
			decryptError = 'Could not decrypt this event.';
		}
	}

	$effect(() => {
		if (getUnlockedKey()) decrypt();
	});

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
		const unlocked = getUnlockedKey();
		if (!unlocked) {
			unlockOpen = true;
			return;
		}

		inviteLoading = true;
		try {
			if (!eventKey) eventKey = await unsealEventKey(data.membership.wrappedKey, unlocked.publicKey, unlocked.privateKey);

			const lookup = await fetch(`/api/users/by-username?username=${encodeURIComponent(inviteUsername)}`);
			const lookupResult: LookupResult = await lookup.json();

			let wrappedKey: string | undefined;
			if (lookupResult.publicKey) {
				wrappedKey = await sealEventKeyFor(eventKey, lookupResult.publicKey);
			}

			const res = await fetch(`/api/events/${data.event.id}/invites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ telegramUsername: inviteUsername, role: inviteRole, wrappedKey })
			});

			const result: InviteResult = await res.json();
			if (!res.ok) {
				inviteStatus = result.error ?? 'Failed to invite';
			} else {
				inviteStatus = result.status === 'added' ? 'Added to event' : 'Invite pending — they need to sign up';
				inviteUsername = '';
				await invalidateAll();
			}
		} catch {
			inviteStatus = 'Something went wrong';
		} finally {
			inviteLoading = false;
		}
	}

	async function resolveInvite(invite: (typeof data.pendingInvites)[number]) {
		const unlocked = getUnlockedKey();
		if (!unlocked || !invite.resolvablePublicKey) return;

		resolvingId = invite.id;
		try {
			if (!eventKey) eventKey = await unsealEventKey(data.membership.wrappedKey, unlocked.publicKey, unlocked.privateKey);
			const wrappedKey = await sealEventKeyFor(eventKey, invite.resolvablePublicKey);

			await fetch(`/api/events/${data.event.id}/pending-invites/${invite.id}/resolve`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ wrappedKey })
			});

			await invalidateAll();
		} finally {
			resolvingId = null;
		}
	}

	async function setRsvp(status: 'going' | 'maybe' | 'declined') {
		const unlocked = getUnlockedKey();
		if (!unlocked) {
			unlockOpen = true;
			return;
		}

		rsvpLoading = true;
		try {
			if (!eventKey) eventKey = await unsealEventKey(data.membership.wrappedKey, unlocked.publicKey, unlocked.privateKey);

			let encryptedDetails: string | undefined;
			let detailsNonce: string | undefined;
			if (rsvpNotes.trim()) {
				const payload = await encryptEventData({ notes: rsvpNotes }, eventKey);
				encryptedDetails = payload.ciphertext;
				detailsNonce = payload.nonce;
			}

			const res = await fetch(`/api/events/${data.event.id}/rsvp`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status, encryptedDetails, detailsNonce })
			});

			const result: RsvpResult = await res.json();
			if (res.ok && result.status) rsvpStatus = result.status;
		} finally {
			rsvpLoading = false;
		}
	}
</script>

<div class="mx-auto mt-8 max-w-md space-y-4">
	{#if !getUnlockedKey()}
		<div class="glass rounded-2xl p-6 text-center">
			<p class="mb-3 text-sm text-neutral-600">Unlock your key to view this event.</p>
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
	{:else if details === null}
		<p class="flex items-center gap-2 text-sm text-neutral-500">
			<SpinnerIcon size={16} class="animate-spin" />
			Decrypting…
		</p>
	{:else}
		<div class="glass rounded-2xl p-6">
			<h1 class="mb-3 text-xl font-semibold text-neutral-900">{details.title}</h1>
			<div class="space-y-1.5 text-sm text-neutral-600">
				{#if details.date}
					<p class="flex items-center gap-2"><CalendarBlankIcon size={16} />{details.date}</p>
				{/if}
				{#if details.location}
					<p class="flex items-center gap-2"><MapPinIcon size={16} />{details.location}</p>
				{/if}
				{#if liveCount !== null}
					<p class="flex items-center gap-2"><UsersIcon size={16} />{liveCount} going</p>
				{/if}
			</div>
			{#if details.description}<p class="mt-3 text-sm text-neutral-700">{details.description}</p>{/if}
		</div>

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
			<label for="rsvp-notes" class="field-label mt-4">Notes (optional, encrypted)</label>
			<textarea
				id="rsvp-notes"
				bind:value={rsvpNotes}
				placeholder="Dietary restrictions, plus-ones, etc."
				class="field-input"
			></textarea>
		</div>

		<div class="glass rounded-2xl p-6">
			<h2 class="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-700">
				<UsersIcon size={16} />
				Members
			</h2>
			<ul class="space-y-1 text-sm">
				{#each data.members as member (member.userId)}
					<li class="flex items-center justify-between">
						<span>{member.firstName ?? member.username ?? member.userId}</span>
						<span class="text-xs text-neutral-500">{member.role}</span>
					</li>
				{/each}
			</ul>
		</div>

		{#if data.isManager}
			<a href="/events/{data.event.id}/scan" class="btn-outline w-full">
				<QrCodeIcon size={16} />
				Scan tickets
			</a>

			<div class="glass rounded-2xl p-6">
				<h2 class="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-700">
					<PaperPlaneTiltIcon size={16} />
					Invite someone
				</h2>
				<form onsubmit={(e) => { e.preventDefault(); handleInvite(); }} class="flex gap-2">
					<input
						type="text"
						bind:value={inviteUsername}
						placeholder="Telegram username"
						class="field-input flex-1"
					/>
					<select bind:value={inviteRole} class="field-input w-auto">
						<option value="attendee">Attendee</option>
						<option value="coorganizer">Co-organizer</option>
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
								<span>@{invite.telegramUsername} ({invite.role})</span>
								{#if invite.resolvable}
									<button
										onclick={() => resolveInvite(invite)}
										disabled={resolvingId === invite.id}
										class="btn-accent px-2.5 py-1 text-xs"
									>
										{resolvingId === invite.id ? 'Granting…' : 'Grant access'}
									</button>
								{:else}
									<span class="flex items-center gap-1 text-xs text-neutral-400">
										<ClockIcon size={14} />
										Waiting for them to sign up
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	{/if}
</div>

<UnlockPassphraseModal bind:open={unlockOpen} onUnlocked={decrypt} />
