import { error, fail } from '@sveltejs/kit';
import {
	createAcademyInvite,
	loadMembersPageData,
	resendAcademyInvite,
	membersRedirect,
	type InviteRole
} from '$lib/server/academy-members-invite';
import { ensureAcademySettingsAccess } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';
import { isSqliteSimulationMode } from '$lib/server/simulation-mode';
import { simulationSettingsData } from '$lib/simulation/sqlite';

const SETTINGS_INVITE_ROLES: InviteRole[] = ['office', 'teacher', 'parent'];

const REDIRECT_PATH = '/settings/members';

export const load: PageServerLoad = async ({ locals, url }) => {
	ensureAcademySettingsAccess(locals);
	const academyId = locals.activeAcademyId;
	if (!academyId) {
		error(403, '활성 학원이 없습니다. 학원을 선택한 뒤 다시 시도하세요.');
	}
	if (isSqliteSimulationMode()) {
		return { ...simulationSettingsData(), inviteRoles: SETTINGS_INVITE_ROLES };
	}
	const data = await loadMembersPageData(academyId, url);
	return {
		...data,
		inviteRoles: SETTINGS_INVITE_ROLES
	};
};

export const actions: Actions = {
	createInvite: async ({ request, locals, url }) => {
		ensureAcademySettingsAccess(locals);
		const academyId = locals.activeAcademyId;
		if (!academyId) return error(403, '활성 학원이 없습니다.');
		const fd = await request.formData();
		const roleRaw = fd.get('role')?.toString()?.trim() ?? '';
		if (!SETTINGS_INVITE_ROLES.includes(roleRaw as InviteRole)) {
			return fail(400, { error: '허용되지 않은 초대 역할입니다.' });
		}
		if (isSqliteSimulationMode()) {
			const email = fd.get('email')?.toString().trim() ?? '';
			const phone = fd.get('phone')?.toString().trim() ?? '';
			if (roleRaw === 'parent' ? !phone : !email) {
				return fail(400, {
					error: roleRaw === 'parent' ? '휴대번호를 입력하세요.' : '이메일을 입력하세요.'
				});
			}
			const notice =
				roleRaw === 'parent'
					? '시뮬레이션 SMS 초대를 생성했습니다.'
					: '시뮬레이션 이메일 초대를 생성했습니다.';
			return membersRedirect(REDIRECT_PATH, notice);
		}
		return createAcademyInvite({
			academyId,
			localsUserId: locals.user?.id,
			formData: fd,
			urlOrigin: url.origin,
			redirectPath: REDIRECT_PATH
		});
	},
	resendInvite: async ({ request, locals, url }) => {
		ensureAcademySettingsAccess(locals);
		const academyId = locals.activeAcademyId;
		if (!academyId) return error(403, '활성 학원이 없습니다.');
		return resendAcademyInvite({
			academyId,
			formData: await request.formData(),
			urlOrigin: url.origin,
			redirectPath: REDIRECT_PATH
		});
	}
};
