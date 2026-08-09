import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const [user] = await db
		.select({
			publicKey: users.publicKey,
			encryptedPrivateKey: users.encryptedPrivateKey,
			salt: users.privateKeySalt,
			nonce: users.privateKeyNonce
		})
		.from(users)
		.where(eq(users.id, locals.user.id))
		.limit(1);

	if (!user?.publicKey || !user.encryptedPrivateKey || !user.salt || !user.nonce) {
		return json({ error: 'Setup incomplete' }, { status: 404 });
	}

	return json(user);
};
