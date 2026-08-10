import { describe, it, expect, vi } from 'vitest';
import { createDbMock } from '$lib/server/testing/db-mock';

const dbMock = createDbMock();
vi.mock('$lib/server/db/index', () => ({ db: dbMock.db }));

const { GET } = await import('./+server');

function makeEvent(user: { id: string } | null) {
	// Route handlers only read params/locals/cookies — a full RequestEvent isn't needed for this seam.
	return {
		params: { token: 'tok-1' },
		locals: { user },
		cookies: { set: vi.fn(), get: vi.fn(), delete: vi.fn() }
	} as unknown as Parameters<typeof GET>[0];
}

async function thrownBy(handler: () => unknown): Promise<{ status: number; location?: string }> {
	try {
		await handler();
	} catch (err) {
		return err as { status: number; location?: string };
	}
	throw new Error('expected a redirect or error to be thrown');
}

describe('GET /join/[token]', () => {
	it('404s on an unknown token', async () => {
		dbMock.setResults([[]]); // event lookup: no match

		expect((await thrownBy(() => GET(makeEvent({ id: 'user-1' })))).status).toBe(404);
	});

	it('404s on a cancelled event', async () => {
		dbMock.setResults([[{ id: 'event-1', cancelledAt: new Date() }]]);

		expect((await thrownBy(() => GET(makeEvent({ id: 'user-1' })))).status).toBe(404);
	});

	it('sends a logged-out visitor to login', async () => {
		dbMock.setResults([[{ id: 'event-1', cancelledAt: null }]]);

		expect(await thrownBy(() => GET(makeEvent(null)))).toMatchObject({ status: 303, location: '/login' });
	});

	it('adds a logged-in visitor as a guest and sends them to the event', async () => {
		dbMock.setResults([
			[{ id: 'event-1', cancelledAt: null }], // event lookup
			undefined // insert membership (onConflictDoNothing makes this idempotent)
		]);

		expect(await thrownBy(() => GET(makeEvent({ id: 'user-1' })))).toMatchObject({
			status: 303,
			location: '/events/event-1'
		});
	});
});
