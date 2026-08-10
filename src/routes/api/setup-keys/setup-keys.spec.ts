import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '$lib/server/testing/db-mock';

const sendTelegramMessage = vi.fn();
vi.mock('$lib/server/telegram/bot', () => ({ sendTelegramMessage }));

const dbMock = createDbMock();
vi.mock('$lib/server/db/index', () => ({ db: dbMock.db }));

const { POST } = await import('./+server');

function makeEvent(username: string | null) {
	// Route handlers only read request/locals/url — a full RequestEvent isn't needed for this seam.
	return {
		request: {
			json: () =>
				Promise.resolve({
					publicKey: 'pk',
					encryptedPrivateKey: 'epk',
					salt: 'salt',
					nonce: 'nonce'
				})
		},
		locals: { user: { id: 'user-2', username } },
		url: new URL('https://evt.example.com/api/setup-keys')
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/setup-keys', () => {
	beforeEach(() => {
		sendTelegramMessage.mockReset();
	});

	it('notifies the inviter when the new user matches a pending invite', async () => {
		dbMock.setResults([
			undefined, // update users
			[{ eventId: 'event-1', invitedBy: 'manager-1' }], // matching pendingInvites
			[{ telegramId: 'tg-manager-1' }] // inviter lookup
		]);

		const res = await POST(makeEvent('bob'));

		expect(await res.json()).toEqual({ success: true });
		expect(sendTelegramMessage).toHaveBeenCalledWith(
			'tg-manager-1',
			expect.stringContaining('/events/event-1')
		);
	});

	it('notifies each inviter when multiple pending invites match', async () => {
		dbMock.setResults([
			undefined, // update users
			[
				{ eventId: 'event-1', invitedBy: 'manager-1' },
				{ eventId: 'event-2', invitedBy: 'manager-2' }
			],
			[{ telegramId: 'tg-manager-1' }],
			[{ telegramId: 'tg-manager-2' }]
		]);

		await POST(makeEvent('bob'));

		expect(sendTelegramMessage).toHaveBeenCalledTimes(2);
		expect(sendTelegramMessage).toHaveBeenCalledWith('tg-manager-1', expect.stringContaining('/events/event-1'));
		expect(sendTelegramMessage).toHaveBeenCalledWith('tg-manager-2', expect.stringContaining('/events/event-2'));
	});

	it('does not notify anyone when there are no matching pending invites', async () => {
		dbMock.setResults([
			undefined, // update users
			[] // no matches
		]);

		const res = await POST(makeEvent('bob'));

		expect(await res.json()).toEqual({ success: true });
		expect(sendTelegramMessage).not.toHaveBeenCalled();
	});

	it('skips the pending-invite lookup entirely when the user has no Telegram username', async () => {
		dbMock.setResults([undefined]); // update users only

		const res = await POST(makeEvent(null));

		expect(await res.json()).toEqual({ success: true });
		expect(sendTelegramMessage).not.toHaveBeenCalled();
	});
});
