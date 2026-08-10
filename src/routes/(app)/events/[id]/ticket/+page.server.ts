import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { tickets } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getEventMembership } from '$lib/server/events/authz';
import { signTicket } from '$lib/server/tickets';
import QRCode from 'qrcode';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const eventId = params.id;

	const membership = await getEventMembership(eventId, locals.user!.id);
	if (!membership) throw error(404, 'Not found');

	const [ticket] = await db
		.select()
		.from(tickets)
		.where(and(eq(tickets.eventId, eventId), eq(tickets.userId, locals.user!.id)))
		.limit(1);

	if (!ticket) throw error(404, 'No ticket for this event yet — RSVP as going first.');

	const checkedIn = Boolean(ticket.checkedInAt);
	if (checkedIn) return { checkedIn, qrDataUrl: null };

	const token = signTicket(ticket.id, ticket.eventId, ticket.userId);
	return { checkedIn, qrDataUrl: await QRCode.toDataURL(token, { width: 300 }) };
};
