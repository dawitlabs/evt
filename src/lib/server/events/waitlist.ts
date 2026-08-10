import { db } from '$lib/server/db/index';
import { rsvps, tickets, users } from '$lib/server/db/schema';
import { and, eq, asc, count } from 'drizzle-orm';
import { sendTelegramMessage } from '$lib/server/telegram/bot';

export async function countGoing(eventId: string): Promise<number> {
	const [row] = await db
		.select({ value: count() })
		.from(rsvps)
		.where(and(eq(rsvps.eventId, eventId), eq(rsvps.status, 'going')));
	return row?.value ?? 0;
}

export async function promoteFromWaitlist(eventId: string, origin: string): Promise<boolean> {
	const [next] = await db
		.select({ id: rsvps.id, userId: rsvps.userId })
		.from(rsvps)
		.where(and(eq(rsvps.eventId, eventId), eq(rsvps.status, 'waitlisted')))
		.orderBy(asc(rsvps.createdAt))
		.limit(1);

	if (!next) return false;

	await db.update(rsvps).set({ status: 'going', updatedAt: new Date() }).where(eq(rsvps.id, next.id));
	await db
		.insert(tickets)
		.values({ eventId, userId: next.userId })
		.onConflictDoNothing({ target: [tickets.eventId, tickets.userId] });

	const [promoted] = await db.select({ telegramId: users.telegramId }).from(users).where(eq(users.id, next.userId)).limit(1);
	if (promoted) {
		await sendTelegramMessage(promoted.telegramId, `You're off the waitlist — you're going! ${origin}/events/${eventId}`);
	}

	return true;
}
