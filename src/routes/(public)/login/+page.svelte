<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TelegramLogoIcon from 'phosphor-svelte/lib/TelegramLogoIcon';
	import SpinnerIcon from 'phosphor-svelte/lib/SpinnerIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import TicketIcon from 'phosphor-svelte/lib/TicketIcon';

	let link = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function startLogin() {
		error = null;
		link = null;
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

<svelte:head><title>Sign in · Evt</title></svelte:head>

<div class="mx-auto mt-24 max-w-sm">
	<div class="glass rounded-2xl p-8 text-center shadow-sm">
		<span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-400">
			<TicketIcon size={24} weight="fill" />
		</span>
		<h1 class="mb-1 text-lg font-semibold text-neutral-900">Welcome to Evt</h1>
		<p class="mb-6 text-sm text-neutral-600">Private events for your people — invites, RSVPs, and tickets in one place.</p>

		{#if error}
			<p class="mb-4 flex items-center justify-center gap-2 text-sm text-red-600">
				<WarningCircleIcon size={16} />
				{error}
			</p>
			<button onclick={startLogin} class="btn-primary w-full">Try again</button>
		{:else if link}
			<a href={link} target="_blank" rel="noreferrer" class="btn-accent w-full">
				<TelegramLogoIcon size={18} weight="fill" />
				Log in with Telegram
			</a>
			<p class="mt-3 text-xs text-neutral-500">Waiting for confirmation…</p>
		{:else}
			<p class="flex items-center justify-center gap-2 text-sm text-neutral-500">
				<SpinnerIcon size={16} class="animate-spin" />
				Preparing login link…
			</p>
		{/if}
	</div>
</div>
