import connectDB from '$lib/server/db';
import { Academy } from '$lib/server/models/academy';
import { AcademyInvite } from '$lib/server/models/academy-invite';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token')?.trim() ?? '';
	if (!token) {
		return { kind: 'missing' as const };
	}
	await connectDB();
	const inv = await AcademyInvite.findOne({ token }).lean();
	if (!inv) {
		return { kind: 'invalid' as const };
	}
	if (inv.expiresAt.getTime() < Date.now()) {
		return { kind: 'expired' as const, email: inv.email };
	}
	const academy = await Academy.findById(inv.academyId).select('name status').lean();
	return {
		kind: 'ok' as const,
		email: inv.email,
		role: inv.role,
		academyName: academy?.name ?? '학원',
		academyStatus: academy?.status ?? 'unknown'
	};
};
