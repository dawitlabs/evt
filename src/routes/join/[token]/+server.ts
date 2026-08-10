import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { events, eventsKeys } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, cookies }) => {
	const [event] = await db
		.select({ id: events.id, cancelledAt: events.cancelledAt })
		.from(events)
		.where(eq(events.inviteToken, params.token))
		.limit(1);

	if (!event || event.cancelledAt) throw error(404, 'This invite link is no longer active');

	if (!locals.user) {
		cookies.set('next', `/join/${params.token}`, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 600
		});
		throw redirect(303, '/login');
	}

	await db
		.insert(eventsKeys)
		.values({ eventId: event.id, userId: locals.user.id, role: 'attendee' })
		.onConflictDoNothing({ target: [eventsKeys.eventId, eventsKeys.userId] });

	throw redirect(303, `/events/${event.id}`);
};
