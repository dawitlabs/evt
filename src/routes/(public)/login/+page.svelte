<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let link = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function startLogin() {
		error = null;
		const res = await fetch('/auth/telegram/start', { method: 'POST' });
		const data = await res.json();
		link = data.link;
		poll(data.token);
	}

	function poll(token: string) {
		const interval = setInterval(async () => {
			const res = await fetch(`/auth/telegram/poll?token=${token}`);
			const data = await res.json();

			if (data.status === 'verified') {
				clearInterval(interval);
				goto(data.redirect);
			} else if (data.status === 'expired') {
				clearInterval(interval);
				error = 'Login link expired, try again.';
			}
		}, 2000);
	}

	onMount(startLogin);
</script>

{#if error}
	<p>{error}</p>
	<button onclick={startLogin}>Try again</button>
{:else if link}
	<a href={link} target="_blank" rel="noreferrer">Log in with Telegram</a>
{/if}
