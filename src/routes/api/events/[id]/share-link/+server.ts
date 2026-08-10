import { json } from '@sveltejs/kit';
import crypto from 'crypto';
import { db } from '$lib/server/db/index';
import { events } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getEventMembership, isManager } from '$lib/server/events/authz';
import type { RequestHandler } from './$types';

async function requireManager(eventId: string, userId: string | undefined) {
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	const membership = await getEventMembership(eventId, userId);
	if (!membership || !isManager(membership.role)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}
	return null;
}

export const POST: RequestHandler = async ({ params, locals }) => {
	const eventId = params.id!;
	const denied = await requireManager(eventId, locals.user?.id);
	if (denied) return denied;

	const inviteToken = crypto.randomBytes(16).toString('base64url');
	await db.update(events).set({ inviteToken }).where(eq(events.id, eventId));

	return json({ inviteToken });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const eventId = params.id!;
	const denied = await requireManager(eventId, locals.user?.id);
	if (denied) return denied;

	await db.update(events).set({ inviteToken: null }).where(eq(events.id, eventId));

	return json({ ok: true });
};
