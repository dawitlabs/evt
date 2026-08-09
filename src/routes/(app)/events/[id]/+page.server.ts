import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { events, eventsKeys, users } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { isManager } from '$lib/server/events/authz';
import { listResolvablePendingInvites } from '$lib/server/events/pendingInvites';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const eventId = params.id;

	const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
	if (!event) throw error(404, 'Not found');

	const [membership] = await db
		.select({ role: eventsKeys.role, wrappedKey: eventsKeys.wrappedKey })
		.from(eventsKeys)
		.where(and(eq(eventsKeys.eventId, eventId), eq(eventsKeys.userId, locals.user!.id)))
		.limit(1);

	if (!membership) throw error(404, 'Not found');

	const members = await db
		.select({
			userId: users.id,
			username: users.username,
			firstName: users.firstName,
			role: eventsKeys.role
		})
		.from(eventsKeys)
		.innerJoin(users, eq(eventsKeys.userId, users.id))
		.where(eq(eventsKeys.eventId, eventId));

	const pendingInvites = isManager(membership.role) ? await listResolvablePendingInvites(eventId) : [];

	return {
		event: { id: event.id, ciphertext: event.ciphertext, nonce: event.nonce },
		membership,
		members,
		pendingInvites,
		isManager: isManager(membership.role)
	};
};
