import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '$lib/server/testing/db-mock';

const sendTelegramMessage = vi.fn();
vi.mock('$lib/server/telegram/bot', () => ({ sendTelegramMessage }));

const dbMock = createDbMock();
vi.mock('$lib/server/db/index', () => ({ db: dbMock.db }));

const { POST } = await import('./+server');

function makeEvent() {
	// Route handlers only read params/request/locals/url — a full RequestEvent isn't needed for this seam.
	return {
		params: { id: 'event-1', pendingId: 'pending-1' },
		request: { json: () => Promise.resolve({ wrappedKey: 'wrapped' }) },
		locals: { user: { id: 'manager-1' } },
		url: new URL('https://evt.example.com/api/events/event-1/pending-invites/pending-1/resolve')
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/events/[id]/pending-invites/[pendingId]/resolve', () => {
	beforeEach(() => {
		sendTelegramMessage.mockReset();
	});

	it('notifies the newly-granted user once access is resolved', async () => {
		dbMock.setResults([
			[{ role: 'owner' }], // getEventMembership
			[{ id: 'pending-1', eventId: 'event-1', telegramUsername: 'bob', role: 'attendee' }], // pending lookup
			[{ id: 'user-2', publicKey: 'pk', telegramId: 'tg-2' }], // target lookup
			undefined // db.batch(insert + delete)
		]);

		const res = await POST(makeEvent());

		expect(await res.json()).toEqual({ status: 'resolved' });
		expect(sendTelegramMessage).toHaveBeenCalledWith(
			'tg-2',
			expect.stringContaining('/events/event-1')
		);
	});

	it('does not notify anyone when the invitee is not resolvable yet', async () => {
		dbMock.setResults([
			[{ role: 'owner' }], // getEventMembership
			[{ id: 'pending-1', eventId: 'event-1', telegramUsername: 'bob', role: 'attendee' }], // pending lookup
			[{ id: 'user-2', publicKey: null, telegramId: 'tg-2' }] // target has no public key yet
		]);

		const res = await POST(makeEvent());

		expect(res.status).toBe(409);
		expect(sendTelegramMessage).not.toHaveBeenCalled();
	});
});
