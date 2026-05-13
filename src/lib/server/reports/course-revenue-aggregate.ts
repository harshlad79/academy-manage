import { InvoiceLine } from '$lib/server/models/invoice-line';
import { Payment } from '$lib/server/models/payment';
import { isPopulatedTeacherLean } from '$lib/server/mongo-populate-guards';
import { isElevatedStaffRole, type AcademyMembershipLocals } from '$lib/server/rbac';
import { Types } from 'mongoose';

export type CourseRevenueRow = {
	courseId: string;
	courseName: string;
	teacherName: string;
	paidCount: number;
	paidTotalKrw: number;
	openCount: number;
	openTotalKrw: number;
};

function oidString(v: unknown): string | null {
	if (v instanceof Types.ObjectId) return v.toString();
	if (typeof v === 'object' && v !== null && '_id' in v) {
		const id = (v as { _id: unknown })._id;
		if (id instanceof Types.ObjectId) return id.toString();
	}
	return null;
}

/** `Enrollment` lean + `courseId`·`teacherId` populate 후 집계 키 */
function courseKeyFromEnrollmentPop(enrollment: unknown): {
	courseId: string;
	courseName: string;
	teacherName: string;
	teacherOid: string | null;
} | null {
	if (typeof enrollment !== 'object' || enrollment === null) return null;
	const e = enrollment as { courseId?: unknown };
	const rawCo = e.courseId;
	if (rawCo === null || rawCo === undefined) return null;
	if (!(typeof rawCo === 'object')) return null;
	const co = rawCo as {
		_id?: unknown;
		name?: unknown;
		teacherId?: unknown;
	};
	const courseId = oidString(co._id);
	if (!courseId) return null;
	const courseName = typeof co.name === 'string' && co.name ? co.name : '(클래스)';
	let teacherName = '—';
	let teacherOid: string | null = null;
	const t = co.teacherId;
	if (isPopulatedTeacherLean(t)) {
		teacherName = t.name;
		teacherOid = t._id.toString();
	} else {
		const raw = oidString(t);
		if (raw) teacherOid = raw;
	}
	return { courseId, courseName, teacherName, teacherOid };
}

const TEACHER_NO_LINK_WARNING =
	'강사 계정에 담당 클래스 연결(linkedTeacherId)이 없습니다. 관리자에게 문의하세요.';

export async function computeCourseRevenueRows(args: {
	academyId: Types.ObjectId;
	membership: AcademyMembershipLocals;
	start: Date;
	endExclusive: Date;
}): Promise<{ rows: CourseRevenueRow[]; scopeWarning: string | null }> {
	const { academyId, membership: m, start, endExclusive } = args;

	const teacherScopeId =
		!isElevatedStaffRole(m.role) && m.role === 'teacher' ? m.linkedTeacherId : null;
	if (m.role === 'teacher' && !teacherScopeId) {
		return { rows: [], scopeWarning: TEACHER_NO_LINK_WARNING };
	}

	function scopeOk(teacherOid: string | null): boolean {
		if (!teacherScopeId) return true;
		return teacherOid === teacherScopeId;
	}

	const agg = new Map<string, CourseRevenueRow>();

	function bump(
		ck: NonNullable<ReturnType<typeof courseKeyFromEnrollmentPop>>,
		patch: Partial<
			Pick<CourseRevenueRow, 'paidCount' | 'paidTotalKrw' | 'openCount' | 'openTotalKrw'>
		>
	) {
		const prev = agg.get(ck.courseId) ?? {
			courseId: ck.courseId,
			courseName: ck.courseName,
			teacherName: ck.teacherName,
			paidCount: 0,
			paidTotalKrw: 0,
			openCount: 0,
			openTotalKrw: 0
		};
		if (patch.paidCount !== undefined) prev.paidCount += patch.paidCount;
		if (patch.paidTotalKrw !== undefined) prev.paidTotalKrw += patch.paidTotalKrw;
		if (patch.openCount !== undefined) prev.openCount += patch.openCount;
		if (patch.openTotalKrw !== undefined) prev.openTotalKrw += patch.openTotalKrw;
		agg.set(ck.courseId, prev);
	}

	const payments = await Payment.find({
		academyId,
		paidAt: { $gte: start, $lt: endExclusive }
	})
		.populate({
			path: 'invoiceLineId',
			populate: {
				path: 'enrollmentId',
				populate: {
					path: 'courseId',
					populate: { path: 'teacherId', select: 'name subject' }
				}
			}
		})
		.lean();

	for (const p of payments) {
		const line = p.invoiceLineId;
		if (typeof line !== 'object' || line === null) continue;
		const en = (line as { enrollmentId?: unknown }).enrollmentId;
		const ck = courseKeyFromEnrollmentPop(en);
		if (!ck || !scopeOk(ck.teacherOid)) continue;
		bump(ck, { paidCount: 1, paidTotalKrw: p.amountKrw });
	}

	const opens = await InvoiceLine.find({ academyId, status: 'open' })
		.populate({
			path: 'enrollmentId',
			populate: {
				path: 'courseId',
				populate: { path: 'teacherId', select: 'name subject' }
			}
		})
		.lean();

	for (const line of opens) {
		const ck = courseKeyFromEnrollmentPop(line.enrollmentId);
		if (!ck || !scopeOk(ck.teacherOid)) continue;
		bump(ck, { openCount: 1, openTotalKrw: line.amountKrw });
	}

	const rows = [...agg.values()].sort((a, b) => a.courseName.localeCompare(b.courseName, 'ko'));

	return { rows, scopeWarning: null };
}
