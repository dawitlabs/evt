<script lang="ts">
	import { unlockCurrentUser } from '$lib/crypto/session.svelte';
	import LockKeyOpenIcon from 'phosphor-svelte/lib/LockKeyOpenIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';

	let { open = $bindable(false), onUnlocked }: { open?: boolean; onUnlocked?: () => void } = $props();

	let passphrase = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleUnlock() {
		error = '';
		loading = true;

		try {
			await unlockCurrentUser(passphrase);
			passphrase = '';
			open = false;
			onUnlocked?.();
		} catch {
			error = 'Wrong passphrase. Try again.';
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-20 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm">
		<div class="glass w-full max-w-sm rounded-2xl p-6 shadow-lg">
			<span class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-400">
				<LockKeyOpenIcon size={20} weight="fill" />
			</span>
			<h2 class="mb-2 text-lg font-semibold text-neutral-900">Unlock your key</h2>
			<p class="mb-4 text-sm text-neutral-600">
				Enter your passphrase to decrypt your private key for this session.
			</p>

			<form onsubmit={(e) => { e.preventDefault(); handleUnlock(); }}>
				<label for="unlock-passphrase" class="field-label">Passphrase</label>
				<input
					id="unlock-passphrase"
					type="password"
					bind:value={passphrase}
					class="field-input mb-3"
				/>

				{#if error}
					<p class="mb-3 flex items-center gap-2 text-sm text-red-600">
						<WarningCircleIcon size={16} />
						{error}
					</p>
				{/if}

				<div class="flex gap-2">
					<button type="submit" disabled={loading} class="btn-primary flex-1">
						{loading ? 'Unlocking…' : 'Unlock'}
					</button>
					<button type="button" onclick={() => (open = false)} class="btn-outline">Cancel</button>
				</div>
			</form>
		</div>
	</div>
{/if}
