import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body: unknown = await request.json();
	const { publicKey, encryptedPrivateKey, salt, nonce } = (body ?? {}) as Record<string, unknown>;

	if (
		typeof publicKey !== 'string' ||
		typeof encryptedPrivateKey !== 'string' ||
		typeof salt !== 'string' ||
		typeof nonce !== 'string'
	) {
		return json({ error: 'Missing fields' }, { status: 400 });
	}

	await db
		.update(users)
		.set({
			publicKey,
			encryptedPrivateKey,
			privateKeySalt: salt,
			privateKeyNonce: nonce
		})
		.where(eq(users.id, locals.user.id));

	return json({ success: true });
};
