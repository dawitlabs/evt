import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { events, rsvps, tickets, users } from '$lib/server/db/schema';
import { and, eq, count, asc } from 'drizzle-orm';
import { getEventMembership } from '$lib/server/events/authz';
import { encryptJson } from '$lib/server/crypto';
import { sendTelegramMessage } from '$lib/server/telegram/bot';
import { PartySocket } from 'partysocket';
import { PARTYKIT_HOST } from '$env/static/private';
import type { RequestHandler } from './$types';

type RsvpStatus = 'going' | 'maybe' | 'declined' | 'waitlisted';

async function countGoing(eventId: string): Promise<number> {
	const [row] = await db
		.select({ value: count() })
		.from(rsvps)
		.where(and(eq(rsvps.eventId, eventId), eq(rsvps.status, 'going')));
	return row?.value ?? 0;
}

async function promoteFromWaitlist(eventId: string, origin: string): Promise<void> {
	const [next] = await db
		.select({ id: rsvps.id, userId: rsvps.userId })
		.from(rsvps)
		.where(and(eq(rsvps.eventId, eventId), eq(rsvps.status, 'waitlisted')))
		.orderBy(asc(rsvps.createdAt))
		.limit(1);

	if (!next) return;

	await db.update(rsvps).set({ status: 'going', updatedAt: new Date() }).where(eq(rsvps.id, next.id));
	await db
		.insert(tickets)
		.values({ eventId, userId: next.userId })
		.onConflictDoNothing({ target: [tickets.eventId, tickets.userId] });

	const [promoted] = await db.select({ telegramId: users.telegramId }).from(users).where(eq(users.id, next.userId)).limit(1);
	if (promoted) {
		await sendTelegramMessage(promoted.telegramId, `You're off the waitlist — you're going! ${origin}/events/${eventId}`);
	}
}

async function broadcastCount(eventId: string, goingCount: number): Promise<void> {
	try {
		await PartySocket.fetch(
			{ host: PARTYKIT_HOST, room: eventId },
			{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: goingCount }) }
		);
	} catch (err) {
		console.error('PartyKit broadcast failed', err);
	}
}

export const POST: RequestHandler = async ({ params, request, locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const eventId = params.id!;
	const membership = await getEventMembership(eventId, locals.user.id);
	if (!membership) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	const body: unknown = await request.json();
	const { status, notes } = (body ?? {}) as Record<string, unknown>;

	if (status !== 'going' && status !== 'maybe' && status !== 'declined') {
		return json({ error: 'Invalid status' }, { status: 400 });
	}
	if (notes !== undefined && typeof notes !== 'string') {
		return json({ error: 'Invalid notes' }, { status: 400 });
	}

	const details = notes?.trim() ? encryptJson({ notes: notes.trim() }) : null;

	const [event] = await db.select({ capacity: events.capacity }).from(events).where(eq(events.id, eventId)).limit(1);
	if (!event) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	const [existing] = await db
		.select({ status: rsvps.status })
		.from(rsvps)
		.where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, locals.user.id)))
		.limit(1);

	let finalStatus: RsvpStatus = status;
	if (status === 'going' && event.capacity !== null && existing?.status !== 'going') {
		const goingCount = await countGoing(eventId);
		if (goingCount >= event.capacity) {
			finalStatus = 'waitlisted';
		}
	}

	await db
		.insert(rsvps)
		.values({
			eventId,
			userId: locals.user.id,
			status: finalStatus,
			encryptedDetails: details?.ciphertext ?? null,
			detailsNonce: details?.nonce ?? null
		})
		.onConflictDoUpdate({
			target: [rsvps.eventId, rsvps.userId],
			set: {
				status: finalStatus,
				encryptedDetails: details?.ciphertext ?? null,
				detailsNonce: details?.nonce ?? null,
				updatedAt: new Date()
			}
		});

	if (finalStatus === 'going') {
		await db
			.insert(tickets)
			.values({ eventId, userId: locals.user.id })
			.onConflictDoNothing({ target: [tickets.eventId, tickets.userId] });
	}

	if (existing?.status === 'going' && finalStatus !== 'going') {
		await promoteFromWaitlist(eventId, url.origin);
	}

	await broadcastCount(eventId, await countGoing(eventId));

	return json({ status: finalStatus });
};

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const eventId = params.id!;
	const membership = await getEventMembership(eventId, locals.user.id);
	if (!membership) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	const rows = await db
		.select({ userId: rsvps.userId, status: rsvps.status })
		.from(rsvps)
		.where(eq(rsvps.eventId, eventId));

	return json(rows);
};
