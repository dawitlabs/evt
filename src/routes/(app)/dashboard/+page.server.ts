import { db } from '$lib/server/db/index';
import { events, eventsKeys } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const rows = await db
		.select({
			eventId: events.id,
			role: eventsKeys.role,
			wrappedKey: eventsKeys.wrappedKey,
			ciphertext: events.ciphertext,
			nonce: events.nonce,
			createdAt: events.createdAt
		})
		.from(eventsKeys)
		.innerJoin(events, eq(eventsKeys.eventId, events.id))
		.where(eq(eventsKeys.userId, locals.user!.id));

	return { events: rows };
};
