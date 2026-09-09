import { fail } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { academyAllowsCommunications } from '$lib/server/academy-flags';
import {
	ANNOUNCEMENT_BODY_MAX,
	ANNOUNCEMENT_TITLE_MAX,
	Announcement
} from '$lib/server/models/announcement';
import { Academy } from '$lib/server/models/academy';
import { AcademyMembership } from '$lib/server/models/academy-membership';
import { Lead } from '$lib/server/models/lead';
import { ParentStudentLink } from '$lib/server/models/parent-student-link';
import { Student } from '$lib/server/models/student';
import {
	ensureStaffAcademyMember,
	failFromGate,
	gateCommunicationsAction,
	isElevatedStaffRole
} from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const ANNOUNCEMENTS_LIMIT = 20;

export type AnnouncementRow = {
	id: string;
	title: string;
	body: string;
	createdByUserId: string;
	createdAt: string;
};

const empty = {
	communicationsEnabled: true,
	canManageCommunications: false,
	parentStudentLinkCount: 0,
	parentMembershipCount: 0,
	studentCount: 0,
	leadNewCount: 0,
	leadWaitlistedCount: 0,
	leadConvertedCount: 0,
	announcements: [] as AnnouncementRow[],
	dbError: null as string | null
};

export const load: PageServerLoad = async ({ locals }) => {
	ensureStaffAcademyMember(locals);
	try {
		const { academyId } = await withAcademyScope();
		const academyDoc = await Academy.findById(academyId).select('communicationsEnabled').lean();
		const communicationsEnabled = academyAllowsCommunications(academyDoc);
		const [
			parentStudentLinkCount,
			parentMembershipCount,
			studentCount,
			leadNewCount,
			leadWaitlistedCount,
			leadConvertedCount
		] = communicationsEnabled
			? await Promise.all([
					ParentStudentLink.countDocuments({ academyId }),
					AcademyMembership.countDocuments({ academyId, role: 'parent' }),
					Student.countDocuments({ academyId }),
					Lead.countDocuments({ academyId, status: 'new' }),
					Lead.countDocuments({ academyId, status: 'waitlisted' }),
					Lead.countDocuments({ academyId, status: 'converted' })
				])
			: [0, 0, 0, 0, 0, 0];
		const announcementRows = communicationsEnabled
			? await Announcement.find({ academyId })
					.sort({ createdAt: -1 })
					.limit(ANNOUNCEMENTS_LIMIT)
					.lean()
			: [];
		const announcements: AnnouncementRow[] = announcementRows.map((a) => ({
			id: a._id.toString(),
			title: a.title,
			body: a.body,
			createdByUserId: a.createdByUserId,
			createdAt: a.createdAt.toISOString()
		}));
		return {
			communicationsEnabled,
			canManageCommunications: isElevatedStaffRole(locals.academyMembership!.role),
			parentStudentLinkCount,
			parentMembershipCount,
			studentCount,
			leadNewCount,
			leadWaitlistedCount,
			leadConvertedCount,
			announcements,
			dbError: null as string | null
		};
	} catch (e) {
		console.error('[communications load]', e);
		return {
			...empty,
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.'
		};
	}
};

export const actions: Actions = {
	createAnnouncement: async ({ request, locals }) => {
		const rg = gateCommunicationsAction(locals);
		if (!rg.ok) return failFromGate(rg);
		const uid = locals.user?.id;
		if (!uid) return fail(401, { error: '로그인이 필요합니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const fd = await request.formData();
		const title = fd.get('title')?.toString()?.trim() ?? '';
		const body = fd.get('body')?.toString()?.trim() ?? '';
		if (!title || title.length > ANNOUNCEMENT_TITLE_MAX) {
			return fail(400, { error: `제목은 1~${ANNOUNCEMENT_TITLE_MAX}자로 입력하세요.` });
		}
		if (!body || body.length > ANNOUNCEMENT_BODY_MAX) {
			return fail(400, { error: `내용은 1~${ANNOUNCEMENT_BODY_MAX}자로 입력하세요.` });
		}
		await Announcement.create({ academyId, title, body, createdByUserId: uid });
		return { success: true as const };
	},

	deleteAnnouncement: async ({ request, locals }) => {
		const rg = gateCommunicationsAction(locals);
		if (!rg.ok) return failFromGate(rg);
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const fd = await request.formData();
		const id = fd.get('id')?.toString()?.trim() ?? '';
		if (!/^[a-f\d]{24}$/i.test(id)) return fail(400, { error: '잘못된 공지 ID입니다.' });
		const result = await Announcement.deleteOne({ _id: id, academyId });
		if (result.deletedCount === 0) return fail(404, { error: '공지를 찾지 못했습니다.' });
		return { success: true as const };
	}
};
