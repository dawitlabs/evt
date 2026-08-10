import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/static/private', () => ({ TICKET_SIGNING_SECRET: 'test-signing-secret' }));

const { signTicket, verifyTicket } = await import('./tickets');

describe('signTicket / verifyTicket', () => {
	it('round-trips a signed ticket', () => {
		const token = signTicket('ticket-1', 'event-1', 'user-1');

		expect(verifyTicket(token)).toEqual({
			ticketId: 'ticket-1',
			eventId: 'event-1',
			userId: 'user-1'
		});
	});

	it('rejects a token with a tampered payload', () => {
		const token = signTicket('ticket-1', 'event-1', 'user-1');
		const decoded = Buffer.from(token, 'base64url').toString('utf-8');
		const tampered = decoded.replace('event-1', 'event-2');
		const forged = Buffer.from(tampered).toString('base64url');

		expect(verifyTicket(forged)).toBeNull();
	});

	it('rejects a token with a tampered signature', () => {
		const token = signTicket('ticket-1', 'event-1', 'user-1');
		const decoded = Buffer.from(token, 'base64url').toString('utf-8');
		const [ticketId, eventId, userId, sig] = decoded.split('.');
		const flipped = sig[0] === 'a' ? 'b' : 'a';
		const forged = Buffer.from(`${ticketId}.${eventId}.${userId}.${flipped}${sig.slice(1)}`).toString(
			'base64url'
		);

		expect(verifyTicket(forged)).toBeNull();
	});

	it('rejects garbage input without throwing', () => {
		expect(verifyTicket('not-a-real-token')).toBeNull();
		expect(verifyTicket('')).toBeNull();
	});

	it('rejects a well-formed but incomplete payload', () => {
		const token = Buffer.from('only.two.parts').toString('base64url');
		expect(verifyTicket(token)).toBeNull();
	});
});
