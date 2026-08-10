<script lang="ts">
	import TicketIcon from 'phosphor-svelte/lib/TicketIcon';
	import SignOutIcon from 'phosphor-svelte/lib/SignOutIcon';

	let { children, data } = $props();
</script>

<header class="glass sticky top-0 z-10">
	<div class="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
		<a href="/dashboard" class="flex items-center gap-2 text-sm font-semibold text-neutral-900">
			<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-400">
				<TicketIcon size={16} weight="fill" />
			</span>
			Evt
		</a>

		<div class="ml-auto flex items-center gap-3">
			{#if data.user.firstName ?? data.user.username}
				<span class="text-sm text-neutral-600">{data.user.firstName ?? data.user.username}</span>
			{/if}
			<form method="POST" action="/auth/logout">
				<button
					type="submit"
					aria-label="Sign out"
					class="flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900"
				>
					<SignOutIcon size={16} />
					Sign out
				</button>
			</form>
		</div>
	</div>
</header>

<main class="px-4 pb-16">
	{@render children()}
</main>
