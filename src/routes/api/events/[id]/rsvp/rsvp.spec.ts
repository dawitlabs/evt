import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '$lib/server/testing/db-mock';

const sendTelegramMessage = vi.fn();
vi.mock('$lib/server/telegram/bot', () => ({ sendTelegramMessage }));

const partySocketFetch = vi.fn(() => Promise.resolve());
vi.mock('partysocket', () => ({ PartySocket: { fetch: partySocketFetch } }));

vi.mock('$env/static/private', () => ({ PARTYKIT_HOST: 'test-host' }));

const dbMock = createDbMock();
vi.mock('$lib/server/db/index', () => ({ db: dbMock.db }));

const { POST } = await import('./+server');

function makeEvent(status: string) {
	// Route handlers only read params/request/locals/url — a full RequestEvent isn't needed for this seam.
	return {
		params: { id: 'event-1' },
		request: { json: () => Promise.resolve({ status }) },
		locals: { user: { id: 'user-1' } },
		url: new URL('https://evt.example.com/api/events/event-1/rsvp')
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/events/[id]/rsvp', () => {
	beforeEach(() => {
		sendTelegramMessage.mockReset();
		partySocketFetch.mockClear();
	});

	it('notifies the promoted attendee when leaving "going" frees a waitlist spot', async () => {
		dbMock.setResults([
			[{ role: 'attendee' }], // getEventMembership
			[{ capacity: 2 }], // event capacity
			[{ status: 'going' }], // existing rsvp
			undefined, // insert rsvps onConflictDoUpdate
			[{ id: 'rsvp-9', userId: 'user-9' }], // next waitlisted rsvp
			undefined, // update rsvps -> going
			[{ telegramId: 'tg-9' }], // promoted user's telegram id
			[{ value: 1 }] // countGoing for broadcast
		]);

		const res = await POST(makeEvent('declined'));

		expect(await res.json()).toEqual({ status: 'declined' });
		expect(sendTelegramMessage).toHaveBeenCalledWith(
			'tg-9',
			expect.stringContaining('/events/event-1')
		);
	});

	it('does not notify anyone when there is nobody on the waitlist to promote', async () => {
		dbMock.setResults([
			[{ role: 'attendee' }], // getEventMembership
			[{ capacity: 2 }], // event capacity
			[{ status: 'going' }], // existing rsvp
			undefined, // insert rsvps onConflictDoUpdate
			[], // waitlist is empty
			[{ value: 0 }] // countGoing for broadcast
		]);

		const res = await POST(makeEvent('declined'));

		expect(await res.json()).toEqual({ status: 'declined' });
		expect(sendTelegramMessage).not.toHaveBeenCalled();
	});

	it('does not touch the waitlist for a fresh RSVP', async () => {
		dbMock.setResults([
			[{ role: 'attendee' }], // getEventMembership
			[{ capacity: null }], // event capacity: uncapped
			[], // existing rsvp: none
			undefined, // insert rsvps onConflictDoUpdate
			[{ value: 1 }] // countGoing for broadcast
		]);

		const res = await POST(makeEvent('going'));

		expect(await res.json()).toEqual({ status: 'going' });
		expect(sendTelegramMessage).not.toHaveBeenCalled();
	});
});
