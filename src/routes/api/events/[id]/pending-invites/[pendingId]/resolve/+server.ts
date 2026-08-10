import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { users, eventsKeys, pendingInvites } from '$lib/server/db/schema';
import { and, eq, ilike } from 'drizzle-orm';
import { getEventMembership, isManager } from '$lib/server/events/authz';
import { sendTelegramMessage } from '$lib/server/telegram/bot';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const eventId = params.id!;
	const pendingId = params.pendingId!;

	const membership = await getEventMembership(eventId, locals.user.id);
	if (!membership || !isManager(membership.role)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body: unknown = await request.json();
	const { wrappedKey } = (body ?? {}) as Record<string, unknown>;
	if (typeof wrappedKey !== 'string') {
		return json({ error: 'Missing fields' }, { status: 400 });
	}

	const [pending] = await db
		.select()
		.from(pendingInvites)
		.where(and(eq(pendingInvites.id, pendingId), eq(pendingInvites.eventId, eventId)))
		.limit(1);

	if (!pending) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	const [target] = await db
		.select({ id: users.id, publicKey: users.publicKey, telegramId: users.telegramId })
		.from(users)
		.where(ilike(users.username, pending.telegramUsername))
		.limit(1);

	if (!target?.publicKey) {
		return json({ error: 'Not resolvable yet' }, { status: 409 });
	}

	await db.batch([
		db.insert(eventsKeys).values({
			eventId,
			userId: target.id,
			wrappedKey,
			role: pending.role,
			invitedBy: locals.user.id
		}),
		db.delete(pendingInvites).where(eq(pendingInvites.id, pendingId))
	]);

	await sendTelegramMessage(
		target.telegramId,
		`You now have access to an event you were invited to: ${url.origin}/events/${eventId}`
	);

	return json({ status: 'resolved' });
};
