import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { tickets } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getEventMembership, isManager } from '$lib/server/events/authz';
import { verifyTicket } from '$lib/server/tickets';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body: unknown = await request.json();
	const { token } = (body ?? {}) as Record<string, unknown>;
	if (typeof token !== 'string') {
		return json({ error: 'Missing token' }, { status: 400 });
	}

	const parsed = verifyTicket(token);
	if (!parsed) {
		return json({ error: "This ticket isn't valid" }, { status: 400 });
	}

	const membership = await getEventMembership(parsed.eventId, locals.user.id);
	if (!membership || !isManager(membership.role)) {
		return json({ error: 'Only hosts can check in guests' }, { status: 403 });
	}

	const [ticket] = await db.select().from(tickets).where(eq(tickets.id, parsed.ticketId)).limit(1);
	if (!ticket) {
		return json({ error: 'Ticket not found' }, { status: 404 });
	}
	if (ticket.checkedInAt) {
		return json({ error: 'Already checked in', checkedInAt: ticket.checkedInAt }, { status: 409 });
	}

	await db
		.update(tickets)
		.set({ checkedInAt: new Date(), checkedInBy: locals.user.id })
		.where(eq(tickets.id, parsed.ticketId));

	return json({ success: true });
};
