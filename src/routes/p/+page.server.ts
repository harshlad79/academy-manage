import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { Attendance } from '$lib/server/models/attendance';
import { Enrollment } from '$lib/server/models/enrollment';
import { InvoiceLine } from '$lib/server/models/invoice-line';
import { Payment } from '$lib/server/models/payment';
import { ParentStudentLink } from '$lib/server/models/parent-student-link';
import { Student } from '$lib/server/models/student';
import { Academy } from '$lib/server/models/academy';
import { academyAllowsParentPortal } from '$lib/server/academy-flags';
import { academyAllowsCommunications } from '$lib/server/academy-flags';
import { Announcement } from '$lib/server/models/announcement';
import { isPopulatedIdName } from '$lib/server/mongo-populate-guards';
import type { PageServerLoad } from './$types';

function resolveAcademyDisplayName(): string {
	const raw = env.PUBLIC_ACADEMY_DISPLAY_NAME?.trim();
	return raw ? raw : '학원';
}

const RECENT_ATTENDANCE_CAP = 48;
const PAYMENT_HISTORY_CAP = 40;
const ANNOUNCEMENTS_CAP = 10;

export type PortalAnnouncement = {
	id: string;
	title: string;
	body: string;
	createdAt: string;
};

function formatPaidAtSeoul(d: Date): string {
	return new Intl.DateTimeFormat('ko-KR', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(d);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) error(401, '로그인이 필요합니다.');
	if (locals.academyMembership?.role !== 'parent') {
		error(403, '학부모 계정만 이 페이지를 볼 수 있습니다.');
	}

	const uid = locals.user.id;

	try {
		const { academyId } = await withAcademyScope();
		const academyDoc = await Academy.findById(academyId)
			.select('status parentPortalEnabled communicationsEnabled')
			.lean();
		const academyOperationalStatus = academyDoc?.status === 'inactive' ? 'inactive' : 'active';
		const communicationsEnabled = academyAllowsCommunications(academyDoc);
		if (!academyAllowsParentPortal(academyDoc)) {
			return {
				academyDisplayName: resolveAcademyDisplayName(),
				academyOperationalStatus,
				parentPortalEnabled: false,
				communicationsEnabled,
				announcements: [] as PortalAnnouncement[],
				students: [],
				openInvoiceLines: [],
				earliestOpenDueDate: null,
				paymentHistory: [],
				recentAttendance: [],
				recentAttendanceCap: RECENT_ATTENDANCE_CAP,
				paymentHistoryCap: PAYMENT_HISTORY_CAP
			};
		}
		const links = await ParentStudentLink.find({ academyId, parentUserId: uid })
			.sort({ createdAt: 1 })
			.lean();

		const studentIds = links.map((l) => l.studentId.toString());

		const studentsRows =
			studentIds.length > 0
				? await Student.find({ academyId, _id: { $in: studentIds } })
						.sort({ name: 1 })
						.lean()
				: [];

		const enrs =
			studentIds.length > 0
				? await Enrollment.find({
						academyId,
						studentId: { $in: studentIds }
					})
						.populate('courseId')
						.sort({ createdAt: 1 })
						.lean()
				: [];

		const coursesByStudent = new Map<
			string,
			{
				id: string;
				courseName: string;
			}[]
		>();

		const studentNameById = new Map(studentsRows.map((s) => [s._id.toString(), s.name]));

		const enrollmentMetaById = new Map<
			string,
			{
				studentName: string;
				courseName: string;
			}
		>();

		for (const row of enrs) {
			const sid = row.studentId.toString();
			const rawCo = row.courseId;
			const co = isPopulatedIdName(rawCo) ? rawCo : null;
			const prev = coursesByStudent.get(sid);
			const entry = {
				id: row._id.toString(),
				courseName: co?.name ?? '(클래스)'
			};
			if (prev) prev.push(entry);
			else coursesByStudent.set(sid, [entry]);

			enrollmentMetaById.set(row._id.toString(), {
				studentName: studentNameById.get(sid) ?? '—',
				courseName: co?.name ?? '(클래스)'
			});
		}

		const enrollmentOidList = enrs.map((r) => r._id);

		const students = studentsRows.map((s) => ({
			id: s._id.toString(),
			name: s.name,
			grade: s.grade ?? null,
			enrollments: coursesByStudent.get(s._id.toString()) ?? []
		}));

		const openLineRows =
			enrollmentOidList.length > 0
				? await InvoiceLine.find({
						academyId,
						enrollmentId: { $in: enrollmentOidList },
						status: 'open'
					})
						.sort({ dueDate: 1, createdAt: -1 })
						.lean()
				: [];

		const openInvoiceLines = openLineRows.map((line) => {
			const meta = enrollmentMetaById.get(line.enrollmentId.toString());
			return {
				id: line._id.toString(),
				studentName: meta?.studentName ?? '—',
				courseName: meta?.courseName ?? '—',
				description: line.description,
				amountKrw: line.amountKrw,
				dueDate: line.dueDate
			};
		});

		let earliestOpenDueDate: string | null = null;
		for (const row of openLineRows) {
			const d = row.dueDate;
			if (!d) continue;
			if (earliestOpenDueDate === null || d < earliestOpenDueDate) {
				earliestOpenDueDate = d;
			}
		}

		const scopedLineProjection =
			enrollmentOidList.length > 0
				? await InvoiceLine.find({ academyId, enrollmentId: { $in: enrollmentOidList } })
						.select('_id description enrollmentId')
						.lean()
				: [];

		const lineById = new Map(scopedLineProjection.map((l) => [l._id.toString(), l]));

		const scopedLineIds = scopedLineProjection.map((l) => l._id);

		const paymentRows =
			scopedLineIds.length > 0
				? await Payment.find({
						academyId,
						invoiceLineId: { $in: scopedLineIds }
					})
						.sort({ paidAt: -1 })
						.limit(PAYMENT_HISTORY_CAP)
						.lean()
				: [];

		const paymentHistory = paymentRows.map((p) => {
			const line = lineById.get(p.invoiceLineId.toString());
			const meta = line ? enrollmentMetaById.get(line.enrollmentId.toString()) : undefined;
			const er = p.externalRef?.trim();
			return {
				id: p._id.toString(),
				paidAtLabel: formatPaidAtSeoul(p.paidAt),
				amountKrw: p.amountKrw,
				method: p.method,
				studentName: meta?.studentName ?? '—',
				courseName: meta?.courseName ?? '—',
				description: line?.description ?? '—',
				note: p.note ?? null,
				externalRef: er ? er : null
			};
		});

		const attendanceRows =
			enrollmentOidList.length > 0
				? await Attendance.find({
						academyId,
						enrollmentId: { $in: enrollmentOidList }
					})
						.sort({ sessionDate: -1 })
						.limit(RECENT_ATTENDANCE_CAP)
						.lean()
				: [];

		const recentAttendance = attendanceRows.map((row) => {
			const meta = enrollmentMetaById.get(row.enrollmentId.toString());
			return {
				id: row._id.toString(),
				sessionDate: row.sessionDate,
				status: row.status,
				studentName: meta?.studentName ?? '—',
				courseName: meta?.courseName ?? '—'
			};
		});

		const announcementRows = communicationsEnabled
			? await Announcement.find({ academyId })
					.sort({ createdAt: -1 })
					.limit(ANNOUNCEMENTS_CAP)
					.lean()
			: [];
		const announcements: PortalAnnouncement[] = announcementRows.map((a) => ({
			id: a._id.toString(),
			title: a.title,
			body: a.body,
			createdAt: a.createdAt.toISOString()
		}));

		return {
			academyDisplayName: resolveAcademyDisplayName(),
			academyOperationalStatus,
			parentPortalEnabled: true,
			communicationsEnabled,
			announcements,
			students,
			openInvoiceLines,
			earliestOpenDueDate,
			paymentHistory,
			recentAttendance,
			recentAttendanceCap: RECENT_ATTENDANCE_CAP,
			paymentHistoryCap: PAYMENT_HISTORY_CAP
		};
	} catch (e) {
		console.error('[portal /p load]', e);
		error(503, '데이터베이스에 연결할 수 없습니다.');
	}
};
