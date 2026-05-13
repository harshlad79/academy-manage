import { resolve } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';
import { buildAcademySwitcherData, type AcademySwitcherData } from '$lib/server/active-academy';
import { navLinksForRole } from '$lib/server/rbac';
import type { LayoutServerLoad } from './$types';

export type { AcademySwitcherData };

async function loadAcademySwitcher(locals: App.Locals): Promise<AcademySwitcherData | null> {
	if (!locals.user || !locals.activeAcademyId) return null;
	return buildAcademySwitcherData({
		userId: locals.user.id,
		activeAcademyId: locals.activeAcademyId,
		formAction: `${resolve('/')}?/setActiveAcademy`
	});
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const path = url.pathname;
	const portal = path === '/p' || path.startsWith('/p/');
	const membership = locals.academyMembership ?? null;
	const academySwitcher = await loadAcademySwitcher(locals);

	if (portal) {
		if (!locals.user) {
			error(401, '로그인이 필요합니다.');
		}
		if (!membership) {
			error(403, '이 학원에 등록된 멤버십이 없습니다. 관리자에게 문의하세요.');
		}
		if (membership.role !== 'parent') {
			redirect(303, '/');
		}
		return {
			user: locals.user,
			academyRole: membership.role,
			navLinks: [...navLinksForRole('parent')],
			portalBrand: '학부모 포털' as const,
			academySwitcher
		};
	}

	if (membership?.role === 'parent') {
		redirect(303, '/p');
	}

	if (
		!portal &&
		membership &&
		locals.academyOperationalStatus === 'inactive' &&
		membership.role !== 'super_admin'
	) {
		error(
			403,
			'비활성 학원에서는 전체관리자만 스태프 메뉴를 이용할 수 있습니다. 내비에서 활성 학원으로 전환해 주세요.'
		);
	}

	return {
		user: locals.user,
		academyRole: membership?.role ?? null,
		navLinks: [...navLinksForRole(membership?.role ?? null)],
		portalBrand: null,
		academySwitcher
	};
};
