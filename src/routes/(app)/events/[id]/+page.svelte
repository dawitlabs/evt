<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getUnlockedKey } from '$lib/crypto/session.svelte';
	import { unsealEventKey, sealEventKeyFor, decryptEventData } from '$lib/crypto/eventKey';
	import UnlockPassphraseModal from '$lib/components/UnlockPassphraseModal.svelte';

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

	let unlockOpen = $state(false);
	let details = $state<EventDetails | null>(null);
	let decryptError = $state('');

	let inviteUsername = $state('');
	let inviteRole = $state<'coorganizer' | 'attendee'>('attendee');
	let inviteStatus = $state('');
	let inviteLoading = $state(false);
	let resolvingId = $state<string | null>(null);

	async function decrypt() {
		const unlocked = getUnlockedKey();
		if (!unlocked) return;

		decryptError = '';
		try {
			const eventKey = await unsealEventKey(data.membership.wrappedKey, unlocked.publicKey, unlocked.privateKey);
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

	async function handleInvite() {
		inviteStatus = '';
		const unlocked = getUnlockedKey();
		if (!unlocked) {
			unlockOpen = true;
			return;
		}

		inviteLoading = true;
		try {
			const lookup = await fetch(`/api/users/by-username?username=${encodeURIComponent(inviteUsername)}`);
			const lookupResult: LookupResult = await lookup.json();

			let wrappedKey: string | undefined;
			if (lookupResult.publicKey) {
				const eventKey = await unsealEventKey(data.membership.wrappedKey, unlocked.publicKey, unlocked.privateKey);
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
			const eventKey = await unsealEventKey(data.membership.wrappedKey, unlocked.publicKey, unlocked.privateKey);
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
