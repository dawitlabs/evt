<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getUnlockedKey } from '$lib/crypto/session.svelte';
	import { unsealEventKey, sealEventKeyFor, decryptEventData, encryptEventData } from '$lib/crypto/eventKey';
	import UnlockPassphraseModal from '$lib/components/UnlockPassphraseModal.svelte';
	import PartySocket from 'partysocket';
	import { PUBLIC_PARTYKIT_HOST } from '$env/static/public';

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

<div class="mx-auto mt-16 max-w-md">
	{#if !getUnlockedKey()}
		<p class="mb-3 text-sm text-gray-600">Unlock your key to view this event.</p>
		<button onclick={() => (unlockOpen = true)} class="rounded bg-black p-2 text-sm text-white">
			Unlock
		</button>
	{:else if decryptError}
		<p class="text-sm text-red-600">{decryptError}</p>
	{:else if details === null}
		<p class="text-sm text-gray-600">Decrypting…</p>
	{:else}
		<h1 class="mb-2 text-xl font-semibold">{details.title}</h1>
		{#if details.date}<p class="text-sm text-gray-600">{details.date}</p>{/if}
		{#if details.location}<p class="text-sm text-gray-600">{details.location}</p>{/if}
		{#if details.description}<p class="mt-3 text-sm">{details.description}</p>{/if}
		{#if liveCount !== null}<p class="mt-2 text-sm text-gray-500">{liveCount} going</p>{/if}

		<div class="mt-6 border-t pt-6">
			<h2 class="mb-2 text-sm font-medium text-gray-700">Your RSVP</h2>
			<div class="flex gap-2">
				<button
					onclick={() => setRsvp('going')}
					disabled={rsvpLoading}
					class="rounded border px-3 py-1.5 text-sm {rsvpStatus === 'going' ? 'bg-black text-white' : ''}"
				>
					Going
				</button>
				<button
					onclick={() => setRsvp('maybe')}
					disabled={rsvpLoading}
					class="rounded border px-3 py-1.5 text-sm {rsvpStatus === 'maybe' ? 'bg-black text-white' : ''}"
				>
					Maybe
				</button>
				<button
					onclick={() => setRsvp('declined')}
					disabled={rsvpLoading}
					class="rounded border px-3 py-1.5 text-sm {rsvpStatus === 'declined' ? 'bg-black text-white' : ''}"
				>
					Can't go
				</button>
			</div>
			{#if rsvpStatus === 'waitlisted'}
				<p class="mt-2 text-sm text-amber-600">You're on the waitlist — we'll let you know if a spot opens up.</p>
			{/if}
			<label for="rsvp-notes" class="mt-3 mb-1 block text-sm font-medium">Notes (optional, encrypted)</label>
			<textarea
				id="rsvp-notes"
				bind:value={rsvpNotes}
				placeholder="Dietary restrictions, plus-ones, etc."
				class="w-full rounded border p-2 text-sm"
			></textarea>
		</div>

		<div class="mt-6 border-t pt-6">
			<h2 class="mb-2 text-sm font-medium text-gray-700">Members</h2>
			<ul class="space-y-1 text-sm">
				{#each data.members as member (member.userId)}
					<li>{member.firstName ?? member.username ?? member.userId} — {member.role}</li>
				{/each}
			</ul>
		</div>

		{#if data.isManager}
			<div class="mt-6 border-t pt-6">
				<h2 class="mb-2 text-sm font-medium text-gray-700">Invite someone</h2>
				<form onsubmit={(e) => { e.preventDefault(); handleInvite(); }} class="flex gap-2">
					<input
						type="text"
						bind:value={inviteUsername}
						placeholder="Telegram username"
						class="flex-1 rounded border p-2 text-sm"
					/>
					<select bind:value={inviteRole} class="rounded border p-2 text-sm">
						<option value="attendee">Attendee</option>
						<option value="coorganizer">Co-organizer</option>
					</select>
					<button type="submit" disabled={inviteLoading} class="rounded bg-black px-3 py-2 text-sm text-white">
						Invite
					</button>
				</form>
				{#if inviteStatus}
					<p class="mt-2 text-sm text-gray-600">{inviteStatus}</p>
				{/if}
			</div>

			{#if data.pendingInvites.length > 0}
				<div class="mt-6 border-t pt-6">
					<h2 class="mb-2 text-sm font-medium text-gray-700">Pending invites</h2>
					<div class="space-y-2">
						{#each data.pendingInvites as invite (invite.id)}
							<div class="flex items-center justify-between rounded border p-2 text-sm">
								<span>@{invite.telegramUsername} ({invite.role})</span>
								{#if invite.resolvable}
									<button
										onclick={() => resolveInvite(invite)}
										disabled={resolvingId === invite.id}
										class="rounded bg-black px-2 py-1 text-xs text-white"
									>
										{resolvingId === invite.id ? 'Granting…' : 'Grant access'}
									</button>
								{:else}
									<span class="text-xs text-gray-400">Waiting for them to sign up</span>
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
