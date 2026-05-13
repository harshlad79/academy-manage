import { fail } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { isYmdSeoulCalendarDate } from '$lib/server/date-seoul';
import { Course } from '$lib/server/models/course';
import { Enrollment } from '$lib/server/models/enrollment';
import { MakeupSession } from '$lib/server/models/makeup-session';
import { isPopulatedIdName } from '$lib/server/mongo-populate-guards';
import {
	ensureStaffAcademyMember,
	failFromGate,
	gateAttendanceWriteAction,
	isElevatedStaffRole
} from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';
import { Types } from 'mongoose';

function isOid(id: string) {
	return /^[a-f\d]{24}$/i.test(id);
}

const MAX_DESC = 2000;

function validOptionalTime(s: string): boolean {
	const t = s.trim();
	if (!t) return true;
	const m = t.match(/^(\d{1,2}):(\d{2})$/);
	if (!m) return false;
	const h = Number(m[1]);
	const min = Number(m[2]);
	return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

/** 강사: 담당 코스 수강 id 목록. elevated: null(필터 없음). 강사+미연결: [] */
async function enrollmentIdsForMakeupScope(
	membership: ReturnType<typeof ensureStaffAcademyMember>,
	academyId: Types.ObjectId
): Promise<Types.ObjectId[] | null> {
	if (isElevatedStaffRole(membership.role)) return null;
	if (membership.role !== 'teacher') return [];
	if (!membership.linkedTeacherId) return [];
	const courses = await Course.find({
		academyId,
		teacherId: new Types.ObjectId(membership.linkedTeacherId)
	})
		.select('_id')
		.lean();
	const cids = courses.map((c) => c._id);
	if (cids.length === 0) return [];
	const ens = await Enrollment.find({ academyId, courseId: { $in: cids } })
		.select('_id')
		.lean();
	return ens.map((e) => e._id);
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const membership = ensureStaffAcademyMember(locals);
	const courseFilterParam = url.searchParams.get('courseId')?.trim() ?? '';

	try {
		const { academyId } = await withAcademyScope();
		const scopeIds = await enrollmentIdsForMakeupScope(membership, academyId);

		const courseRows = await Course.find({ academyId }).sort({ name: 1 }).lean();
		const courses = courseRows.map((c) => ({ id: c._id.toString(), name: c.name }));

		type ScopeMode = 'all' | 'none' | Types.ObjectId[];
		const mode: ScopeMode = scopeIds === null ? 'all' : scopeIds.length === 0 ? 'none' : scopeIds;

		let listFilter: Record<string, unknown>;
		if (courseFilterParam && isOid(courseFilterParam)) {
			const inCourse = await Enrollment.find({ academyId, courseId: courseFilterParam })
				.select('_id')
				.lean();
			let ids = inCourse.map((e) => e._id);
			if (mode === 'none') {
				ids = [];
			} else if (mode !== 'all') {
				const set = new Set(mode.map((x) => x.toString()));
				ids = ids.filter((x) => set.has(x.toString()));
			}
			listFilter =
				ids.length > 0
					? { academyId, enrollmentId: { $in: ids } }
					: { academyId, _id: { $in: [] } };
		} else if (mode === 'none') {
			listFilter = { academyId, _id: { $in: [] } };
		} else if (mode === 'all') {
			listFilter = { academyId };
		} else {
			listFilter = { academyId, enrollmentId: { $in: mode } };
		}

		const makeupRows = await MakeupSession.find(listFilter)
			.sort({ sessionDate: -1, sessionTime: -1, createdAt: -1 })
			.populate({
				path: 'enrollmentId',
				populate: [
					{ path: 'studentId', select: 'name' },
					{ path: 'courseId', select: 'name' }
				]
			})
			.limit(200)
			.lean();

		const rows = makeupRows.map((m) => {
			const en = m.enrollmentId;
			let studentName = '—';
			let courseName = '—';
			if (en && typeof en === 'object' && 'studentId' in en && 'courseId' in en) {
				const st = (en as { studentId: unknown }).studentId;
				const co = (en as { courseId: unknown }).courseId;
				if (isPopulatedIdName(st)) studentName = st.name;
				if (isPopulatedIdName(co)) courseName = co.name;
			}
			return {
				id: m._id.toString(),
				studentName,
				courseName,
				sessionDate: m.sessionDate,
				sessionTime: m.sessionTime?.trim() || '',
				description: m.description,
				createdAt: m.createdAt?.toISOString() ?? ''
			};
		});

		let enrollmentOptions: { id: string; label: string }[] = [];
		if (mode === 'none') {
			enrollmentOptions = [];
		} else {
			const optFilter: Record<string, unknown> =
				mode === 'all' ? { academyId } : { academyId, _id: { $in: mode } };
			const enrs = await Enrollment.find(optFilter)
				.populate('studentId')
				.populate('courseId')
				.sort({ createdAt: -1 })
				.limit(500)
				.lean();

			enrollmentOptions = enrs.map((row) => {
				const st = isPopulatedIdName(row.studentId) ? row.studentId : null;
				const co = isPopulatedIdName(row.courseId) ? row.courseId : null;
				const label =
					st && co ? `${st.name} · ${co.name}` : (st?.name ?? co?.name ?? row._id.toString());
				return { id: row._id.toString(), label };
			});
		}

		return {
			rows,
			courses,
			courseFilterId: courseFilterParam,
			enrollmentOptions,
			dbError: null as string | null
		};
	} catch (e) {
		console.error('[makeups load]', e);
		return {
			rows: [] as {
				id: string;
				studentName: string;
				courseName: string;
				sessionDate: string;
				sessionTime: string;
				description: string;
				createdAt: string;
			}[],
			courses: [] as { id: string; name: string }[],
			courseFilterId: courseFilterParam,
			enrollmentOptions: [] as { id: string; label: string }[],
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.'
		};
	}
};

async function loadCourseTeacherForEnrollment(
	academyId: Types.ObjectId,
	enrollmentId: string
): Promise<{ teacherId: Types.ObjectId } | null> {
	const en = await Enrollment.findOne({ _id: enrollmentId, academyId }).lean();
	if (!en) return null;
	const co = await Course.findOne({ _id: en.courseId, academyId }).select('teacherId').lean();
	if (!co) return null;
	return { teacherId: co.teacherId };
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const enrollmentId = String(data.get('enrollmentId') ?? '');
		const sessionDate = String(data.get('sessionDate') ?? '').trim();
		const sessionTimeRaw = String(data.get('sessionTime') ?? '').trim();
		const description = String(data.get('description') ?? '').trim();
		if (!isOid(enrollmentId)) return fail(400, { error: '수강을 선택하세요.' });
		if (!isYmdSeoulCalendarDate(sessionDate))
			return fail(400, { error: '보강일(날짜)가 올바르지 않습니다.' });
		if (!validOptionalTime(sessionTimeRaw))
			return fail(400, { error: '시간은 HH:mm 형식이거나 비워 두세요.' });
		if (!description) return fail(400, { error: '설명을 입력하세요.' });
		if (description.length > MAX_DESC)
			return fail(400, { error: `설명은 ${MAX_DESC}자 이하로 입력하세요.` });

		const enExists = await Enrollment.exists({ _id: enrollmentId, academyId });
		if (!enExists) return fail(400, { error: '선택한 수강이 이 학원에 없습니다.' });

		const ct = await loadCourseTeacherForEnrollment(academyId, enrollmentId);
		if (!ct) return fail(400, { error: '수강 또는 클래스를 찾을 수 없습니다.' });
		const gate = gateAttendanceWriteAction(locals, ct.teacherId);
		if (!gate.ok) return failFromGate(gate);

		await MakeupSession.create({
			academyId,
			enrollmentId,
			sessionDate,
			sessionTime: sessionTimeRaw || undefined,
			description
		});
		return { success: true as const };
	},

	delete: async ({ request, locals }) => {
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		if (!isOid(id)) return fail(400, { error: '잘못된 보강 ID입니다.' });
		const doc = await MakeupSession.findOne({ _id: id, academyId }).lean();
		if (!doc) return fail(404, { error: '보강 일정을 찾지 못했습니다.' });
		const ct = await loadCourseTeacherForEnrollment(academyId, doc.enrollmentId.toString());
		if (!ct) return fail(400, { error: '연결 수강을 확인할 수 없습니다.' });
		const gate = gateAttendanceWriteAction(locals, ct.teacherId);
		if (!gate.ok) return failFromGate(gate);

		await MakeupSession.deleteOne({ _id: id, academyId });
		return { success: true as const };
	}
};
