import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '$lib/server/testing/db-mock';

const sendTelegramMessage = vi.fn();
vi.mock('$lib/server/telegram/bot', () => ({ sendTelegramMessage }));

vi.mock('$env/dynamic/private', () => ({
	env: { EVENT_DATA_KEY: Buffer.alloc(32, 7).toString('base64') }
}));

const dbMock = createDbMock();
vi.mock('$lib/server/db/index', () => ({ db: dbMock.db }));

const { PATCH, DELETE } = await import('./+server');
const { encryptJson } = await import('$lib/server/crypto');

function makeEvent(body?: unknown) {
	// Route handlers only read params/request/locals/url — a full RequestEvent isn't needed for this seam.
	return {
		params: { id: 'event-1' },
		request: { json: () => Promise.resolve(body) },
		locals: { user: { id: 'user-1' } },
		url: new URL('https://evt.example.com/api/events/event-1')
	} as unknown as Parameters<typeof PATCH>[0];
}

describe('PATCH/DELETE /api/events/[id]', () => {
	beforeEach(() => {
		sendTelegramMessage.mockReset();
	});

	it('rejects edits from non-managers', async () => {
		dbMock.setResults([[{ role: 'attendee' }]]); // getEventMembership

		const res = await PATCH(makeEvent({ title: 'New title' }));

		expect(res.status).toBe(403);
	});

	it('rejects cancellation from non-managers', async () => {
		dbMock.setResults([[{ role: 'attendee' }]]); // getEventMembership

		const res = await DELETE(makeEvent());

		expect(res.status).toBe(403);
	});

	it('cancels an event and notifies going/maybe guests', async () => {
		const blob = encryptJson({ title: 'Party', description: '', date: '', location: '' });
		dbMock.setResults([
			[{ role: 'owner' }], // getEventMembership
			[{ id: 'event-1', ...blob, capacity: null, cancelledAt: null }], // event lookup
			undefined, // update -> cancelledAt
			[{ telegramId: 'tg-2' }] // rsvped guests
		]);

		const res = await DELETE(makeEvent());

		expect(await res.json()).toEqual({ ok: true });
		expect(sendTelegramMessage).toHaveBeenCalledWith('tg-2', expect.stringContaining('Party was cancelled'));
	});
});
