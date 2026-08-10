import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { events } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getEventMembership } from '$lib/server/events/authz';
import { decryptJson } from '$lib/server/crypto';
import type { RequestHandler } from './$types';

interface EventDetails {
	title: string;
	description: string;
	date: string;
	location: string;
}

function escapeIcs(text: string): string {
	return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const eventId = params.id;

	const membership = await getEventMembership(eventId, locals.user!.id);
	if (!membership) throw error(404, 'Not found');

	const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
	if (!event) throw error(404, 'Not found');

	const details = decryptJson<EventDetails>(event);
	if (!details.date) throw error(404, 'This event has no date yet');

	// datetime-local "YYYY-MM-DDTHH:MM" -> floating local ICS "YYYYMMDDTHHMM00"
	const dtstart = `${details.date.replace(/[-:]/g, '')}00`;

	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//evt//EN',
		'BEGIN:VEVENT',
		`UID:${event.id}@evt`,
		`DTSTART:${dtstart}`,
		`SUMMARY:${escapeIcs(details.title)}`,
		details.location ? `LOCATION:${escapeIcs(details.location)}` : null,
		details.description ? `DESCRIPTION:${escapeIcs(details.description)}` : null,
		'END:VEVENT',
		'END:VCALENDAR'
	]
		.filter(Boolean)
		.join('\r\n');

	return new Response(ics, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'attachment; filename="event.ics"'
		}
	});
};
