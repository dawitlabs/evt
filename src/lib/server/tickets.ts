import { createHmac, timingSafeEqual } from 'node:crypto';
import { TICKET_SIGNING_SECRET } from '$env/static/private';

interface VerifiedTicket {
	ticketId: string;
	eventId: string;
	userId: string;
}

function sign(payload: string): string {
	return createHmac('sha256', TICKET_SIGNING_SECRET).update(payload).digest('hex');
}

export function signTicket(ticketId: string, eventId: string, userId: string): string {
	const payload = `${ticketId}.${eventId}.${userId}`;
	return Buffer.from(`${payload}.${sign(payload)}`).toString('base64url');
}

export function verifyTicket(token: string): VerifiedTicket | null {
	try {
		const decoded = Buffer.from(token, 'base64url').toString('utf-8');
		const [ticketId, eventId, userId, sig] = decoded.split('.');
		if (!ticketId || !eventId || !userId || !sig) return null;

		const expected = Buffer.from(sign(`${ticketId}.${eventId}.${userId}`), 'hex');
		const actual = Buffer.from(sig, 'hex');
		if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

		return { ticketId, eventId, userId };
	} catch {
		return null;
	}
}
