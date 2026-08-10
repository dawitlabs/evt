import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('session');
	if (token) {
		await db.delete(sessions).where(eq(sessions.token, token));
		cookies.delete('session', { path: '/' });
	}

	throw redirect(303, '/login');
};
