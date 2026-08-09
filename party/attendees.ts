import type * as Party from 'partykit/server';

export default class AttendeesServer implements Party.Server {
	constructor(readonly room: Party.Room) {}

	async onRequest(req: Party.Request): Promise<Response> {
		if (req.method !== 'POST') {
			return new Response('method not allowed', { status: 405 });
		}

		const body: unknown = await req.json();
		const goingCount = typeof (body as { count?: unknown })?.count === 'number' ? (body as { count: number }).count : null;

		if (goingCount === null) {
			return new Response('invalid body', { status: 400 });
		}

		this.room.broadcast(JSON.stringify({ type: 'count', count: goingCount }));
		return new Response('ok');
	}
}
