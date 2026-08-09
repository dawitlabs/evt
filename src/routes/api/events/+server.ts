import { json } from '@sveltejs/kit';
import crypto from 'crypto';
import { db } from '$lib/server/db/index';
import { events, eventsKeys } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!locals.user.publicKey) {
		return json({ error: 'Setup incomplete' }, { status: 400 });
	}

	const body: unknown = await request.json();
	const { ciphertext, nonce, wrappedKey, capacity } = (body ?? {}) as Record<string, unknown>;

	if (typeof ciphertext !== 'string' || typeof nonce !== 'string' || typeof wrappedKey !== 'string') {
		return json({ error: 'Missing fields' }, { status: 400 });
	}

	if (capacity !== undefined && typeof capacity !== 'number') {
		return json({ error: 'Invalid capacity' }, { status: 400 });
	}

	const eventId = crypto.randomUUID();

	await db.batch([
		db.insert(events).values({ id: eventId, creatorId: locals.user.id, ciphertext, nonce, capacity: capacity ?? null }),
		db.insert(eventsKeys).values({
			eventId,
			userId: locals.user.id,
			wrappedKey,
			role: 'owner'
		})
	]);

	return json({ id: eventId });
};
