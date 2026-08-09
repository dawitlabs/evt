import { json } from '@sveltejs/kit';
import { getEventMembership, isManager } from '$lib/server/events/authz';
import { listResolvablePendingInvites } from '$lib/server/events/pendingInvites';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const eventId = params.id!;
	const membership = await getEventMembership(eventId, locals.user.id);
	if (!membership || !isManager(membership.role)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	return json(await listResolvablePendingInvites(eventId));
};
