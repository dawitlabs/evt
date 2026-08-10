import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '$lib/server/testing/db-mock';

const sendTelegramMessage = vi.fn();
vi.mock('$lib/server/telegram/bot', () => ({ sendTelegramMessage }));

const dbMock = createDbMock();
vi.mock('$lib/server/db/index', () => ({ db: dbMock.db }));

const { POST } = await import('./+server');

function makeEvent(overrides: { body: unknown }) {
	// Route handlers only read params/request/locals/url — a full RequestEvent isn't needed for this seam.
	return {
		params: { id: 'event-1' },
		request: { json: () => Promise.resolve(overrides.body) },
		locals: { user: { id: 'manager-1' } },
		url: new URL('https://evt.example.com/api/events/event-1/invites')
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/events/[id]/invites', () => {
	beforeEach(() => {
		sendTelegramMessage.mockReset();
	});

	it('notifies the invitee when they are added directly to the event', async () => {
		dbMock.setResults([
			[{ role: 'owner' }], // getEventMembership
			[{ id: 'user-2', publicKey: 'pk', telegramId: 'tg-2' }], // target lookup
			undefined // insert eventsKeys
		]);

		const res = await POST(
			makeEvent({ body: { telegramUsername: '@bob', role: 'attendee', wrappedKey: 'wrapped' } })
		);

		expect(await res.json()).toEqual({ status: 'added' });
		expect(sendTelegramMessage).toHaveBeenCalledWith(
			'tg-2',
			expect.stringContaining('/events/event-1')
		);
	});

	it('does not notify anyone when the invite is pending (invitee has no account yet)', async () => {
		dbMock.setResults([
			[{ role: 'owner' }], // getEventMembership
			[], // target lookup: no matching user
			undefined // insert pendingInvites
		]);

		const res = await POST(
			makeEvent({ body: { telegramUsername: '@bob', role: 'attendee' } })
		);

		expect(await res.json()).toEqual({ status: 'pending' });
		expect(sendTelegramMessage).not.toHaveBeenCalled();
	});

	it('rejects non-managers before touching Telegram', async () => {
		dbMock.setResults([[{ role: 'attendee' }]]); // getEventMembership: not a manager

		const res = await POST(
			makeEvent({ body: { telegramUsername: '@bob', role: 'attendee' } })
		);

		expect(res.status).toBe(403);
		expect(sendTelegramMessage).not.toHaveBeenCalled();
	});
});
