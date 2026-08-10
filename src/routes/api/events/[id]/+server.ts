import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { events, rsvps, users } from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getEventMembership, isManager } from '$lib/server/events/authz';
import { countGoing, promoteFromWaitlist } from '$lib/server/events/waitlist';
import { encryptJson, decryptJson } from '$lib/server/crypto';
import { sendTelegramMessage } from '$lib/server/telegram/bot';
import type { RequestHandler } from './$types';

interface EventDetails {
	title: string;
	description: string;
	date: string;
	location: string;
}

async function notifyRsvpedGuests(eventId: string, text: string): Promise<void> {
	const guests = await db
		.select({ telegramId: users.telegramId })
		.from(rsvps)
		.innerJoin(users, eq(rsvps.userId, users.id))
		.where(and(eq(rsvps.eventId, eventId), inArray(rsvps.status, ['going', 'maybe'])));

	await Promise.all(guests.map((guest) => sendTelegramMessage(guest.telegramId, text)));
}

export const PATCH: RequestHandler = async ({ params, request, locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const eventId = params.id!;
	const membership = await getEventMembership(eventId, locals.user.id);
	if (!membership || !isManager(membership.role)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body: unknown = await request.json();
	const { title, description, date, location, capacity } = (body ?? {}) as Record<string, unknown>;

	if (typeof title !== 'string' || !title.trim()) {
		return json({ error: 'Title is required' }, { status: 400 });
	}
	if (
		(description !== undefined && typeof description !== 'string') ||
		(date !== undefined && typeof date !== 'string') ||
		(location !== undefined && typeof location !== 'string')
	) {
		return json({ error: 'Invalid fields' }, { status: 400 });
	}
	if (capacity !== undefined && capacity !== null && typeof capacity !== 'number') {
		return json({ error: 'Invalid capacity' }, { status: 400 });
	}

	const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
	if (!event) {
		return json({ error: 'Not found' }, { status: 404 });
	}
	if (event.cancelledAt) {
		return json({ error: 'This event was cancelled' }, { status: 400 });
	}

	const previous = decryptJson<EventDetails>(event);
	const updated: EventDetails = {
		title: title.trim(),
		description: (description as string | undefined) ?? '',
		date: (date as string | undefined) ?? '',
		location: (location as string | undefined) ?? ''
	};
	const newCapacity = capacity ?? null;

	const { ciphertext, nonce } = encryptJson(updated);
	await db
		.update(events)
		.set({ ciphertext, nonce, capacity: newCapacity, updatedAt: new Date() })
		.where(eq(events.id, eventId));

	if (updated.date !== previous.date && updated.date) {
		await notifyRsvpedGuests(
			eventId,
			`${updated.title} moved to ${updated.date}: ${url.origin}/events/${eventId}`
		);
	}

	const capacityRaised = newCapacity === null || (event.capacity !== null && newCapacity > event.capacity);
	if (capacityRaised) {
		while (newCapacity === null || (await countGoing(eventId)) < newCapacity) {
			const promoted = await promoteFromWaitlist(eventId, url.origin);
			if (!promoted) break;
		}
	}

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const eventId = params.id!;
	const membership = await getEventMembership(eventId, locals.user.id);
	if (!membership || !isManager(membership.role)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
	if (!event) {
		return json({ error: 'Not found' }, { status: 404 });
	}
	if (event.cancelledAt) {
		return json({ ok: true });
	}

	await db.update(events).set({ cancelledAt: new Date() }).where(eq(events.id, eventId));

	const details = decryptJson<EventDetails>(event);
	await notifyRsvpedGuests(eventId, `${details.title} was cancelled: ${url.origin}/events/${eventId}`);

	return json({ ok: true });
};
