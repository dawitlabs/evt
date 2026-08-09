import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { users } from '$lib/server/db/schema';
import { ilike } from 'drizzle-orm';
import { normalizeTelegramUsername } from '$lib/server/events/username';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const username = url.searchParams.get('username');
	if (!username) {
		return json({ error: 'Missing username' }, { status: 400 });
	}

	const normalized = normalizeTelegramUsername(username);

	const [user] = await db
		.select({ publicKey: users.publicKey })
		.from(users)
		.where(ilike(users.username, normalized))
		.limit(1);

	return json({
		found: Boolean(user),
		hasPublicKey: Boolean(user?.publicKey),
		publicKey: user?.publicKey ?? null
	});
};
