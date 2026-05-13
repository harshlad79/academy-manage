import { fail } from '@sveltejs/kit';
import {
	effectiveAttendanceBefore,
	normalizeAttendanceReasonForStore,
	shouldLogAttendanceChange,
	attendanceStatusLabelKo
} from '$lib/server/attendance-audit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { formatSeoulDateString, isYmdSeoulCalendarDate } from '$lib/server/date-seoul';
import {
	Attendance,
	attendanceStatuses,
	type AttendanceStatus
} from '$lib/server/models/attendance';
import { AttendanceAuditLog } from '$lib/server/models/attendance-audit-log';
import { Course } from '$lib/server/models/course';
import { Enrollment } from '$lib/server/models/enrollment';
import { isPopulatedIdName } from '$lib/server/mongo-populate-guards';
import {
	ensureStaffAcademyMember,
	failFromGate,
	gateAttendanceWriteAction
} from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';
import { Types } from 'mongoose';

function isOid(id: string) {
	return /^[a-f\d]{24}$/i.test(id);
}

const MAX_REASON = 500;

function isAttendanceStatus(s: string): s is AttendanceStatus {
	return (attendanceStatuses as readonly string[]).includes(s);
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const membership = ensureStaffAcademyMember(locals);
	const courseId = url.searchParams.get('courseId')?.trim() ?? '';
	const dateParam = url.searchParams.get('date')?.trim() ?? '';
	const sessionDate =
		dateParam && isYmdSeoulCalendarDate(dateParam) ? dateParam : formatSeoulDateString();

	try {
		const { academyId } = await withAcademyScope();
		const courseFilter: Record<string, unknown> =
			membership.role === 'teacher'
				? membership.linkedTeacherId
					? { academyId, teacherId: new Types.ObjectId(membership.linkedTeacherId) }
					: { academyId, _id: { $in: [] } }
				: { academyId };
		const courseRows = await Course.find(courseFilter).sort({ name: 1 }).lean();
		const courses = courseRows.map((c) => ({
			id: c._id.toString(),
			name: c.name
		}));

		let selectedCourseId = courseId;
		if (selectedCourseId && !isOid(selectedCourseId)) selectedCourseId = '';
		if (selectedCourseId) {
			const exists = await Course.exists({ _id: selectedCourseId, academyId });
			if (!exists) selectedCourseId = '';
		}

		if (!selectedCourseId && courses.length > 0) selectedCourseId = courses[0].id;

		const rows: {
			enrollmentId: string;
			studentName: string;
			status: AttendanceStatus;
			reason: string;
		}[] = [];

		if (selectedCourseId) {
			const ens = await Enrollment.find({ academyId, courseId: selectedCourseId })
				.populate('studentId')
				.sort({ createdAt: 1 })
				.lean();

			const enrollmentIds = ens.map((e) => e._id);
			const atts =
				enrollmentIds.length > 0
					? await Attendance.find({
							academyId,
							sessionDate,
							enrollmentId: { $in: enrollmentIds }
						}).lean()
					: [];

			const attMap = new Map(atts.map((a) => [a.enrollmentId.toString(), a] as const));

			for (const e of ens) {
				const st = isPopulatedIdName(e.studentId) ? e.studentId : null;
				const idStr = e._id.toString();
				const rec = attMap.get(idStr);
				rows.push({
					enrollmentId: idStr,
					studentName: st?.name ?? '—',
					status: rec?.status ?? 'present',
					reason: rec?.reason?.trim() ?? ''
				});
			}
		}

		type AuditTrailRow = {
			id: string;
			createdAt: string;
			actorUserId: string;
			studentName: string;
			changeSummary: string;
			reasonHint: string | null;
		};

		let auditTrail: AuditTrailRow[] = [];
		if (
			selectedCourseId &&
			isYmdSeoulCalendarDate(sessionDate) &&
			courses.some((c) => c.id === selectedCourseId)
		) {
			const logRows = await AttendanceAuditLog.find({
				academyId,
				courseId: selectedCourseId,
				sessionDate
			})
				.sort({ createdAt: -1 })
				.limit(80)
				.populate({
					path: 'enrollmentId',
					populate: { path: 'studentId', select: 'name' }
				})
				.lean();

			auditTrail = logRows.map((doc) => {
				const enrollment = doc.enrollmentId;
				let studentName = '—';
				if (enrollment && typeof enrollment === 'object' && 'studentId' in enrollment) {
					const st = (enrollment as { studentId: unknown }).studentId;
					if (isPopulatedIdName(st)) studentName = st.name;
				}

				const pr = doc.previousReason?.trim();
				const nr = doc.newReason?.trim();

				let reasonHint: string | null = null;
				if ((pr ?? '') !== '' || (nr ?? '') !== '') reasonHint = `[${pr || '—'}]→[${nr || '—'}]`;

				const idVal = doc._id;
				return {
					id:
						typeof idVal === 'object' && idVal instanceof Types.ObjectId
							? idVal.toString()
							: String(idVal),
					createdAt: (doc as { createdAt?: Date }).createdAt?.toISOString() ?? '',
					actorUserId: doc.actorUserId,
					studentName,
					changeSummary: `${attendanceStatusLabelKo(doc.previousStatus)}→${attendanceStatusLabelKo(doc.newStatus)}`,
					reasonHint
				};
			});
		}

		return {
			courses,
			selectedCourseId,
			sessionDate,
			rows,
			auditTrail,
			dbError: null as string | null
		};
	} catch (e) {
		console.error('[attendance load]', e);
		return {
			courses: [] as { id: string; name: string }[],
			selectedCourseId: '',
			sessionDate: formatSeoulDateString(),
			rows: [] as {
				enrollmentId: string;
				studentName: string;
				status: AttendanceStatus;
				reason: string;
			}[],
			auditTrail: [] as {
				id: string;
				createdAt: string;
				actorUserId: string;
				studentName: string;
				changeSummary: string;
				reasonHint: string | null;
			}[],
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.'
		};
	}
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const courseId = String(data.get('courseId') ?? '');
		const sessionDate = String(data.get('sessionDate') ?? '').trim();
		if (!isOid(courseId)) return fail(400, { error: '클래스를 선택하세요.' });
		if (!isYmdSeoulCalendarDate(sessionDate))
			return fail(400, { error: '날짜가 올바르지 않습니다.' });
		const course = await Course.findOne({ _id: courseId, academyId }).lean();
		if (!course) return fail(400, { error: '선택한 클래스가 이 학원에 없습니다.' });
		const gate = gateAttendanceWriteAction(locals, course.teacherId);
		if (!gate.ok) return failFromGate(gate);

		const enrollments = await Enrollment.find({ academyId, courseId }).lean();
		const enrollmentIds = enrollments.map((e) => e._id);
		const existingAtts =
			enrollmentIds.length > 0
				? await Attendance.find({
						academyId,
						enrollmentId: { $in: enrollmentIds },
						sessionDate
					}).lean()
				: [];
		const existingByEnr = new Map(existingAtts.map((a) => [a.enrollmentId.toString(), a] as const));

		const courseOid = new Types.ObjectId(courseId);
		const actorUserId = locals.user?.id ?? 'unknown';

		const auditPayload: {
			academyId: typeof academyId;
			courseId: Types.ObjectId;
			enrollmentId: Types.ObjectId;
			sessionDate: string;
			actorUserId: string;
			previousStatus: AttendanceStatus;
			previousReason: string;
			newStatus: AttendanceStatus;
			newReason: string;
		}[] = [];

		for (const e of enrollments) {
			const idStr = e._id.toString();
			const rawStatus = String(data.get(`status_${idStr}`) ?? '').trim();
			if (!isAttendanceStatus(rawStatus))
				return fail(400, { error: `출결 상태가 올바르지 않습니다. (${idStr})` });
			const reasonRaw = String(data.get(`reason_${idStr}`) ?? '').trim();
			if (reasonRaw.length > MAX_REASON)
				return fail(400, { error: `사유는 ${MAX_REASON}자 이하로 입력하세요.` });

			const prevEff = effectiveAttendanceBefore(existingByEnr.get(idStr) ?? null);
			const storedReasonNext = normalizeAttendanceReasonForStore(rawStatus, reasonRaw);
			const nextEff = { status: rawStatus, reason: storedReasonNext };

			const replacement: {
				academyId: typeof academyId;
				enrollmentId: Types.ObjectId;
				sessionDate: string;
				status: AttendanceStatus;
				reason?: string;
			} = {
				academyId,
				enrollmentId: e._id,
				sessionDate,
				status: rawStatus
			};
			if (rawStatus !== 'present' && storedReasonNext) replacement.reason = storedReasonNext;

			await Attendance.replaceOne({ academyId, enrollmentId: e._id, sessionDate }, replacement, {
				upsert: true,
				runValidators: true
			});

			if (shouldLogAttendanceChange(prevEff, nextEff)) {
				auditPayload.push({
					academyId,
					courseId: courseOid,
					enrollmentId: e._id,
					sessionDate,
					actorUserId,
					previousStatus: prevEff.status,
					previousReason: prevEff.reason,
					newStatus: nextEff.status,
					newReason: nextEff.reason
				});
			}
		}

		if (auditPayload.length > 0) {
			await AttendanceAuditLog.insertMany(auditPayload);
		}

		return { success: true as const };
	}
};
