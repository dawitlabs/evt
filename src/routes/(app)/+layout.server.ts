import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	if (!locals.user.publicKey && url.pathname !== '/setup-keys') {
		throw redirect(303, '/setup-keys');
	}

	return { user: locals.user };
};
