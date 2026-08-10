import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '$lib/server/testing/db-mock';

const sendTelegramMessage = vi.fn();
vi.mock('$lib/server/telegram/bot', () => ({ sendTelegramMessage }));

const dbMock = createDbMock();
vi.mock('$lib/server/db/index', () => ({ db: dbMock.db }));

const { upsertTelegramUser } = await import('./telegram');

describe('upsertTelegramUser', () => {
	beforeEach(() => {
		sendTelegramMessage.mockReset();
	});

	it('converts matching pending invites into memberships and notifies the new user', async () => {
		dbMock.setResults([
			[], // existing user lookup: none
			[{ id: 'user-1', telegramId: 'tg-1', username: 'bob' }], // insert users returning
			[{ id: 'inv-1', eventId: 'event-1', role: 'attendee', invitedBy: 'manager-1' }], // pending invites match
			undefined, // insert eventsKeys
			undefined // delete pending invite
		]);

		await upsertTelegramUser({ telegramId: 'tg-1', username: 'bob' }, 'https://evt.example.com');

		expect(sendTelegramMessage).toHaveBeenCalledWith('tg-1', expect.stringContaining('/events/event-1'));
	});

	it('skips invite resolution when the user has no username', async () => {
		dbMock.setResults([
			[], // existing user lookup: none
			[{ id: 'user-1', telegramId: 'tg-1', username: null }] // insert users returning
		]);

		await upsertTelegramUser({ telegramId: 'tg-1' }, 'https://evt.example.com');

		expect(sendTelegramMessage).not.toHaveBeenCalled();
	});

	it('does not resolve invites for a returning user', async () => {
		dbMock.setResults([
			[{ id: 'user-1', telegramId: 'tg-1', username: 'bob' }] // existing user found
		]);

		await upsertTelegramUser({ telegramId: 'tg-1', username: 'bob' }, 'https://evt.example.com');

		expect(sendTelegramMessage).not.toHaveBeenCalled();
	});
});
