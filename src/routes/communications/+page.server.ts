import { withAcademyScope } from '$lib/server/academy-scope';
import { AcademyMembership } from '$lib/server/models/academy-membership';
import { Lead } from '$lib/server/models/lead';
import { ParentStudentLink } from '$lib/server/models/parent-student-link';
import { Student } from '$lib/server/models/student';
import { ensureStaffAcademyMember } from '$lib/server/rbac';
import type { PageServerLoad } from './$types';

const empty = {
	parentStudentLinkCount: 0,
	parentMembershipCount: 0,
	studentCount: 0,
	leadNewCount: 0,
	leadWaitlistedCount: 0,
	leadConvertedCount: 0,
	dbError: null as string | null
};

export const load: PageServerLoad = async ({ locals }) => {
	ensureStaffAcademyMember(locals);
	try {
		const { academyId } = await withAcademyScope();
		const [
			parentStudentLinkCount,
			parentMembershipCount,
			studentCount,
			leadNewCount,
			leadWaitlistedCount,
			leadConvertedCount
		] = await Promise.all([
			ParentStudentLink.countDocuments({ academyId }),
			AcademyMembership.countDocuments({ academyId, role: 'parent' }),
			Student.countDocuments({ academyId }),
			Lead.countDocuments({ academyId, status: 'new' }),
			Lead.countDocuments({ academyId, status: 'waitlisted' }),
			Lead.countDocuments({ academyId, status: 'converted' })
		]);
		return {
			parentStudentLinkCount,
			parentMembershipCount,
			studentCount,
			leadNewCount,
			leadWaitlistedCount,
			leadConvertedCount,
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
