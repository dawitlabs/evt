import { unlockPrivateKey } from './keys.ts';

interface UnlockedKey {
	privateKey: Uint8Array;
	publicKey: string;
}

interface KeyMaterialResponse {
	publicKey: string;
	encryptedPrivateKey: string;
	salt: string;
	nonce: string;
}

function isKeyMaterialResponse(value: unknown): value is KeyMaterialResponse {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.publicKey === 'string' &&
		typeof v.encryptedPrivateKey === 'string' &&
		typeof v.salt === 'string' &&
		typeof v.nonce === 'string'
	);
}

let cached = $state<UnlockedKey | null>(null);

export function getUnlockedKey(): UnlockedKey | null {
	return cached;
}

export async function unlockCurrentUser(passphrase: string): Promise<void> {
	const res = await fetch('/api/me/key-material');
	const body: unknown = await res.json().catch(() => ({}));

	if (!res.ok) {
		const message = typeof (body as { error?: unknown })?.error === 'string'
			? (body as { error: string }).error
			: 'Failed to load key material';
		throw new Error(message);
	}

	if (!isKeyMaterialResponse(body)) {
		throw new Error('Unexpected key material response');
	}

	const privateKey = await unlockPrivateKey(passphrase, body);
	cached = { privateKey, publicKey: body.publicKey };
}

export function clearUnlockedKey(): void {
	cached = null;
}
