<script lang="ts">
    import {goto} from '$app/navigation'
    import { generateKeypair } from '$lib/crypto/keys';

    let passphrase = $state('');
    let confirmPassphrase = $state('');
    let error = $state('');
    let loading = $state(false);

    async function handleSetup(){
        error = '';

        if(passphrase.length < 8){
            error = 'passphrase length must be at least 8 characters';
            return ;
        }

        if(passphrase !== confirmPassphrase){
            error = 'passphrases does not match';
            return ;
        }

        loading = true;
        try{
        const keys = await generateKeypair(passphrase);

        const res = await fetch('/api/setup-keys', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(keys),
        });

        if(!res.ok) throw new Error('Failed to save keys');

        goto('/dashboard');


        }catch(e){
            error = 'something went wrong. please try again';
            console.error(e)
        }finally{
            loading = false
        }
    }
</script>

<div class="mx-auto mt-16 max-w-md">
	<h1 class="mb-2 text-xl font-semibold">setup your encryption key</h1>

	<p class="mb-6 text-sm text-gray-600">
		Choose a passphrase. This encrypts your private key - we never see it, and if you forget it,
		your encrypted data can't be recovered. Write it down somewhere safe.
	</p>

	<form onsubmit={(e) => { e.preventDefault(); handleSetup(); }}>
		<label for="passphrase" class="mb-1 block text-sm font-medium">Passphrase</label>
		<input
			id="passphrase"
			type="password"
			bind:value={passphrase}
			class="mb-3 w-full rounded border p-2"
		/>

		<label for="confirm-passphrase" class="mb-1 block text-sm font-medium">Confirm passphrase</label>
		<input
			id="confirm-passphrase"
			type="password"
			bind:value={confirmPassphrase}
			class="mb-3 w-full rounded border p-2"
		/>

		{#if error}
			<p class="mb-3 text-sm text-red-600">{error}</p>
		{/if}

		<button type="submit" disabled={loading} class="w-full rounded bg-black p-2 text-white">
			{loading ? 'Generating keys…' : 'Continue'}
		</button>
	</form>
</div>
