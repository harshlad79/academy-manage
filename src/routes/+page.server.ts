import { dev } from '$app/environment';
import { fail, redirect } from '@sveltejs/kit';
import { Types } from 'mongoose';
import {
	ACTIVE_ACADEMY_COOKIE,
	academyAllowsResolvedContext,
	isOidHex
} from '$lib/server/active-academy';
import { withAcademyScope } from '$lib/server/academy-scope';
import connectDB from '$lib/server/db';
import { Academy } from '$lib/server/models/academy';
import { AcademyMembership } from '$lib/server/models/academy-membership';
import { BankDeposit } from '$lib/server/models/bank-deposit';
import { Course } from '$lib/server/models/course';
import { Enrollment } from '$lib/server/models/enrollment';
import { InvoiceLine } from '$lib/server/models/invoice-line';
import { MakeupSession } from '$lib/server/models/makeup-session';
import { Student } from '$lib/server/models/student';
import { Teacher } from '$lib/server/models/teacher';
import type { Actions, PageServerLoad } from './$types';
import type { AcademyRole } from '$lib/server/rbac';

const emptyStats = {
	studentCount: 0,
	courseCount: 0,
	openInvoiceCount: 0,
	openInvoiceTotalKrw: 0,
	enrollmentCount: 0,
	unmatchedDepositCount: 0,
	makeupSessionCount: 0,
	teacherCount: 0,
	dbError: null as string | null
};

export const load: PageServerLoad = async ({ locals }) => {
	const membership = locals.academyMembership;
	const isStaff = membership != null && membership.role !== 'parent';

	if (!isStaff) {
		return emptyStats;
	}

	try {
		const { academyId } = await withAcademyScope();
		const [
			studentCount,
			courseCount,
			enrollmentCount,
			invoiceAgg,
			unmatchedDepositCount,
			makeupSessionCount,
			teacherCount
		] = await Promise.all([
			Student.countDocuments({ academyId }),
			Course.countDocuments({ academyId }),
			Enrollment.countDocuments({ academyId }),
			InvoiceLine.aggregate<{ count?: number; total?: number }>([
				{ $match: { academyId, status: 'open' } },
				{
					$group: {
						_id: null,
						count: { $sum: 1 },
						total: { $sum: '$amountKrw' }
					}
				}
			]),
			BankDeposit.countDocuments({ academyId, status: 'unmatched' }),
			MakeupSession.countDocuments({ academyId }),
			Teacher.countDocuments({ academyId })
		]);

		const agg = invoiceAgg[0];
		return {
			studentCount,
			courseCount,
			openInvoiceCount: agg?.count ?? 0,
			openInvoiceTotalKrw: agg?.total ?? 0,
			enrollmentCount,
			unmatchedDepositCount,
			makeupSessionCount,
			teacherCount,
			dbError: null as string | null
		};
	} catch (e) {
		console.error('[dashboard load]', e);
		return {
			...emptyStats,
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.'
		};
	}
};

export const actions: Actions = {
	setActiveAcademy: async ({ request, cookies, locals, url }) => {
		if (!locals.user) return fail(401, { error: '로그인이 필요합니다.' });
		const fd = await request.formData();
		const idRaw = fd.get('academyId')?.toString()?.trim();
		if (!idRaw || !isOidHex(idRaw)) {
			return fail(400, { error: '학원 ID가 올바르지 않습니다.' });
		}
		await connectDB();
		const oid = new Types.ObjectId(idRaw);
		const mem = await AcademyMembership.findOne({ userId: locals.user.id, academyId: oid }).lean();
		if (!mem) {
			return fail(403, { error: '해당 학원에 소속되지 않았습니다.' });
		}
		const ac = await Academy.findById(oid).select('status').lean();
		if (!academyAllowsResolvedContext(ac?.status, mem.role as AcademyRole)) {
			return fail(400, {
				error:
					'비활성 학원입니다. 전체관리자(super_admin) 또는 학부모(parent)만 해당 학원으로 전환할 수 있습니다.'
			});
		}
		cookies.set(ACTIVE_ACADEMY_COOKIE, idRaw.toLowerCase(), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 24 * 180
		});
		const ref = request.headers.get('referer');
		let dest = '/';
		if (ref) {
			try {
				const u = new URL(ref);
				if (u.origin === url.origin) dest = `${u.pathname}${u.search}`;
			} catch {
				/* ignore */
			}
		}
		redirect(303, dest);
	}
};
