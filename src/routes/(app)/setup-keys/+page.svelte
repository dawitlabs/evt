<script lang="ts">
	import { goto } from '$app/navigation';
	import { generateKeypair } from '$lib/crypto/keys';
	import LockKeyIcon from 'phosphor-svelte/lib/LockKeyIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';

	let passphrase = $state('');
	let confirmPassphrase = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSetup() {
		error = '';

		if (passphrase.length < 8) {
			error = 'Passphrase must be at least 8 characters';
			return;
		}

		if (passphrase !== confirmPassphrase) {
			error = 'Passphrases do not match';
			return;
		}

		loading = true;
		try {
			const keys = await generateKeypair(passphrase);

			const res = await fetch('/api/setup-keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(keys)
			});

			if (!res.ok) throw new Error('Failed to save keys');

			goto('/dashboard');
		} catch (e) {
			error = 'Something went wrong. Please try again.';
			console.error(e);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mx-auto mt-8 max-w-md">
	<div class="glass rounded-2xl p-6">
		<span class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-400">
			<LockKeyIcon size={20} weight="fill" />
		</span>
		<h1 class="mb-2 text-xl font-semibold text-neutral-900">Set up your encryption key</h1>

		<p class="mb-6 text-sm text-neutral-600">
			Choose a passphrase. This encrypts your private key — we never see it, and if you forget it,
			your encrypted data can't be recovered. Write it down somewhere safe.
		</p>

		<form onsubmit={(e) => { e.preventDefault(); handleSetup(); }}>
			<label for="passphrase" class="field-label">Passphrase</label>
			<input id="passphrase" type="password" bind:value={passphrase} class="field-input mb-3" />

			<label for="confirm-passphrase" class="field-label">Confirm passphrase</label>
			<input
				id="confirm-passphrase"
				type="password"
				bind:value={confirmPassphrase}
				class="field-input mb-3"
			/>

			{#if error}
				<p class="mb-3 flex items-center gap-2 text-sm text-red-600">
					<WarningCircleIcon size={16} />
					{error}
				</p>
			{/if}

			<button type="submit" disabled={loading} class="btn-primary w-full">
				{loading ? 'Generating keys…' : 'Continue'}
			</button>
		</form>
	</div>
</div>
