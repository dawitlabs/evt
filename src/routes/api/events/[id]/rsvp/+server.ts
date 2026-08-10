import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { events, rsvps, tickets } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getEventMembership } from '$lib/server/events/authz';
import { countGoing, promoteFromWaitlist } from '$lib/server/events/waitlist';
import { encryptJson } from '$lib/server/crypto';
import { PartySocket } from 'partysocket';
import { PARTYKIT_HOST } from '$env/static/private';
import type { RequestHandler } from './$types';

type RsvpStatus = 'going' | 'maybe' | 'declined' | 'waitlisted';

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

	const [event] = await db
		.select({ capacity: events.capacity, cancelledAt: events.cancelledAt })
		.from(events)
		.where(eq(events.id, eventId))
		.limit(1);
	if (!event) {
		return json({ error: 'Not found' }, { status: 404 });
	}
	if (event.cancelledAt) {
		return json({ error: 'This event was cancelled' }, { status: 400 });
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
