import { error } from '@sveltejs/kit';
import { getEventMembership, isManager } from '$lib/server/events/authz';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const membership = await getEventMembership(params.id, locals.user!.id);
	if (!membership || !isManager(membership.role)) {
		throw error(403, 'Not authorized to scan tickets for this event');
	}

	return {};
};
