<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import jsQR from 'jsqr';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import QrCodeIcon from 'phosphor-svelte/lib/QrCodeIcon';

	let video: HTMLVideoElement;
	let canvas: HTMLCanvasElement;
	let stream: MediaStream | null = null;

	let cameraError = $state('');
	let scanning = $state(true);
	let result = $state('');

	async function startCamera() {
		try {
			stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
			video.srcObject = stream;
			await video.play();
			requestAnimationFrame(scanFrame);
		} catch {
			cameraError = 'Could not access the camera. Check your browser permissions.';
		}
	}

	function scanFrame() {
		if (!scanning) return;

		const ctx = canvas.getContext('2d');
		if (!ctx || video.videoWidth === 0) {
			requestAnimationFrame(scanFrame);
			return;
		}

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		ctx.drawImage(video, 0, 0);
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const code = jsQR(imageData.data, imageData.width, imageData.height);

		if (code) {
			handleScan(code.data);
		} else {
			requestAnimationFrame(scanFrame);
		}
	}

	async function handleScan(token: string) {
		scanning = false;
		try {
			const res = await fetch('/api/checkin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token })
			});
			const data = await res.json();
			result = res.ok ? 'Checked in' : (data.error ?? 'Scan failed');
		} catch {
			result = 'Scan failed';
		}

		setTimeout(() => {
			result = '';
			scanning = true;
			requestAnimationFrame(scanFrame);
		}, 2000);
	}

	onMount(startCamera);
	onDestroy(() => stream?.getTracks().forEach((track) => track.stop()));
</script>

<div class="mx-auto mt-8 max-w-sm text-center">
	<div class="glass overflow-hidden rounded-2xl p-4">
		{#if cameraError}
			<p class="flex items-center justify-center gap-2 py-8 text-sm text-red-600">
				<WarningCircleIcon size={16} />
				{cameraError}
			</p>
		{:else}
			<video bind:this={video} class="w-full rounded-xl" playsinline muted></video>
			<canvas bind:this={canvas} class="hidden"></canvas>
			{#if result}
				<p
					class="mt-3 flex items-center justify-center gap-2 text-sm font-medium {result === 'Checked in'
						? 'text-green-600'
						: 'text-red-600'}"
				>
					{#if result === 'Checked in'}
						<CheckCircleIcon size={16} weight="fill" />
					{:else}
						<WarningCircleIcon size={16} />
					{/if}
					{result}
				</p>
			{:else}
				<p class="mt-3 flex items-center justify-center gap-2 text-sm text-neutral-500">
					<QrCodeIcon size={16} />
					Point the camera at a ticket QR code
				</p>
			{/if}
		{/if}
	</div>
</div>
