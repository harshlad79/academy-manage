import { fail } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { Attendance } from '$lib/server/models/attendance';
import { AttendanceAuditLog } from '$lib/server/models/attendance-audit-log';
import { Course } from '$lib/server/models/course';
import { Enrollment } from '$lib/server/models/enrollment';
import { InvoiceLine } from '$lib/server/models/invoice-line';
import { MakeupSession } from '$lib/server/models/makeup-session';
import { Payment } from '$lib/server/models/payment';
import { Student } from '$lib/server/models/student';
import { isPopulatedIdName } from '$lib/server/mongo-populate-guards';
import { ensureDirectoryAccess, failFromGate, gateDirectoryAction } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

function isOid(id: string) {
	return /^[a-f\d]{24}$/i.test(id);
}

export const load: PageServerLoad = async ({ url, locals }) => {
	ensureDirectoryAccess(locals);
	const studentId = url.searchParams.get('studentId')?.trim() ?? '';
	const courseId = url.searchParams.get('courseId')?.trim() ?? '';
	try {
		const { academyId } = await withAcademyScope();
		const studentRows = await Student.find({ academyId }).sort({ name: 1 }).lean();
		const students = studentRows.map((s) => ({
			id: s._id.toString(),
			name: s.name
		}));
		const courseRows = await Course.find({ academyId }).sort({ name: 1 }).lean();
		const courses = courseRows.map((c) => ({
			id: c._id.toString(),
			name: c.name
		}));

		const filter: Record<string, unknown> = { academyId };
		if (studentId && isOid(studentId)) filter.studentId = studentId;
		if (courseId && isOid(courseId)) filter.courseId = courseId;

		const rows = await Enrollment.find(filter)
			.populate('studentId')
			.populate('courseId')
			.sort({ createdAt: -1 })
			.lean();

		const enrollments = rows.map((row) => {
			const st = isPopulatedIdName(row.studentId) ? row.studentId : null;
			const co = isPopulatedIdName(row.courseId) ? row.courseId : null;
			return {
				id: row._id.toString(),
				studentId: st?._id?.toString() ?? '',
				studentName: st?.name ?? '—',
				courseId: co?._id?.toString() ?? '',
				courseName: co?.name ?? '—'
			};
		});

		return {
			enrollments,
			students,
			courses,
			filterStudentId: studentId,
			filterCourseId: courseId,
			dbError: null as string | null
		};
	} catch (e) {
		console.error('[enrollments load]', e);
		return {
			enrollments: [] as {
				id: string;
				studentId: string;
				studentName: string;
				courseId: string;
				courseName: string;
			}[],
			students: [] as { id: string; name: string }[],
			courses: [] as { id: string; name: string }[],
			filterStudentId: studentId,
			filterCourseId: courseId,
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.'
		};
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const studentId = String(data.get('studentId') ?? '');
		const courseId = String(data.get('courseId') ?? '');
		if (!isOid(studentId)) return fail(400, { error: '학생을 선택하세요.' });
		if (!isOid(courseId)) return fail(400, { error: '클래스를 선택하세요.' });
		const st = await Student.exists({ _id: studentId, academyId });
		const co = await Course.exists({ _id: courseId, academyId });
		if (!st) return fail(400, { error: '선택한 학생이 이 학원에 없습니다.' });
		if (!co) return fail(400, { error: '선택한 클래스가 이 학원에 없습니다.' });
		try {
			await Enrollment.create({ academyId, studentId, courseId });
		} catch (e: unknown) {
			const code = e && typeof e === 'object' && 'code' in e ? (e as { code: number }).code : 0;
			if (code === 11000) return fail(400, { error: '이미 같은 클래스에 등록된 학생입니다.' });
			throw e;
		}
		return { success: true as const };
	},

	delete: async ({ request, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		if (!isOid(id)) return fail(400, { error: '잘못된 수강 ID입니다.' });
		const invoiceLineRows = await InvoiceLine.find({ academyId, enrollmentId: id })
			.select('_id')
			.lean();
		const invoiceLineIds = invoiceLineRows.map((r) => r._id);
		if (invoiceLineIds.length > 0) {
			await Payment.deleteMany({ academyId, invoiceLineId: { $in: invoiceLineIds } });
		}
		await Attendance.deleteMany({ academyId, enrollmentId: id });
		await AttendanceAuditLog.deleteMany({ academyId, enrollmentId: id });
		await MakeupSession.deleteMany({ academyId, enrollmentId: id });
		await InvoiceLine.deleteMany({ academyId, enrollmentId: id });
		const result = await Enrollment.deleteOne({ _id: id, academyId });
		if (result.deletedCount === 0)
			return fail(404, { error: '해당 학원에서 수강을 찾지 못했습니다.' });
		return { success: true as const };
	}
};
