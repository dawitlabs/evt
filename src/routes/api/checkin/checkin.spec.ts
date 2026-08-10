import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '$lib/server/testing/db-mock';

const verifyTicket = vi.fn();
vi.mock('$lib/server/tickets', () => ({ verifyTicket }));

const dbMock = createDbMock();
vi.mock('$lib/server/db/index', () => ({ db: dbMock.db }));

const { POST } = await import('./+server');

function makeEvent(token: string) {
	// Route handlers only read request/locals — a full RequestEvent isn't needed for this seam.
	return {
		request: { json: () => Promise.resolve({ token }) },
		locals: { user: { id: 'staff-1' } }
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/checkin', () => {
	beforeEach(() => {
		verifyTicket.mockReset();
	});

	it('rejects a token that fails signature verification before touching the database', async () => {
		verifyTicket.mockReturnValue(null);

		const res = await POST(makeEvent('bad-token'));

		expect(res.status).toBe(400);
	});

	it('rejects a scanner who is not a manager of the ticket\'s event', async () => {
		verifyTicket.mockReturnValue({ ticketId: 'ticket-1', eventId: 'event-1', userId: 'user-1' });
		dbMock.setResults([[{ role: 'attendee' }]]); // getEventMembership

		const res = await POST(makeEvent('valid-token'));

		expect(res.status).toBe(403);
	});

	it('checks in a valid, not-yet-used ticket', async () => {
		verifyTicket.mockReturnValue({ ticketId: 'ticket-1', eventId: 'event-1', userId: 'user-1' });
		dbMock.setResults([
			[{ role: 'owner' }], // getEventMembership
			[{ cancelledAt: null }], // event cancelled check
			[{ id: 'ticket-1', checkedInAt: null }], // ticket lookup
			undefined // update -> checked in
		]);

		const res = await POST(makeEvent('valid-token'));

		expect(await res.json()).toEqual({ success: true });
	});

	it('rejects a ticket that has already been checked in', async () => {
		verifyTicket.mockReturnValue({ ticketId: 'ticket-1', eventId: 'event-1', userId: 'user-1' });
		const checkedInAt = new Date();
		dbMock.setResults([
			[{ role: 'owner' }], // getEventMembership
			[{ cancelledAt: null }], // event cancelled check
			[{ id: 'ticket-1', checkedInAt }] // already checked in
		]);

		const res = await POST(makeEvent('valid-token'));

		expect(res.status).toBe(409);
	});
});
