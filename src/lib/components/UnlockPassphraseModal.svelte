<script lang="ts">
	import { unlockCurrentUser } from '$lib/crypto/session.svelte';

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
	<div class="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-sm rounded border bg-white p-6">
			<h2 class="mb-2 text-lg font-semibold">Unlock your key</h2>
			<p class="mb-4 text-sm text-gray-600">
				Enter your passphrase to decrypt your private key for this session.
			</p>

			<form onsubmit={(e) => { e.preventDefault(); handleUnlock(); }}>
				<label for="unlock-passphrase" class="mb-1 block text-sm font-medium">Passphrase</label>
				<input
					id="unlock-passphrase"
					type="password"
					bind:value={passphrase}
					class="mb-3 w-full rounded border p-2"
				/>

				{#if error}
					<p class="mb-3 text-sm text-red-600">{error}</p>
				{/if}

				<div class="flex gap-2">
					<button
						type="submit"
						disabled={loading}
						class="flex-1 rounded bg-black p-2 text-white"
					>
						{loading ? 'Unlocking…' : 'Unlock'}
					</button>
					<button
						type="button"
						onclick={() => (open = false)}
						class="rounded border p-2"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
