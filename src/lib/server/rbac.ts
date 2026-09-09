import { error, fail } from '@sveltejs/kit';
import { Types } from 'mongoose';

/** PRD §6.1 — 플랫폼·학원 맥락 공통 역할 코드 */
export const ACADEMY_ROLES = [
	'super_admin',
	'academy_admin',
	'office',
	'teacher',
	'parent'
] as const;
export type AcademyRole = (typeof ACADEMY_ROLES)[number];

export type AcademyMembershipLocals = {
	role: AcademyRole;
	/** `teacher` 역할일 때 `Teacher` 문서와의 연결(담당 반 스코프) */
	linkedTeacherId: string | null;
};

export function isElevatedStaffRole(role: AcademyRole): boolean {
	return role === 'super_admin' || role === 'academy_admin' || role === 'office';
}

/** `$app/paths` `resolve` 가 기대하는 경로 문자열 리터럴 유지용 */
export const NAV_LINKS_TEACHER = [
	{ href: '/', label: '대시보드' },
	{ href: '/reports', label: '리포트' },
	{ href: '/makeups', label: '보강' },
	{ href: '/attendance', label: '출결' },
	{ href: '/communications', label: '소통' }
] as const;

/** PRD 학부모 포털 `/p/*` — 읽기 전용 MVP */
export const NAV_LINKS_PARENT = [{ href: '/p', label: '내 자녀' }] as const;

export const NAV_LINKS_FULL = [
	{ href: '/', label: '대시보드' },
	{ href: '/students', label: '학생 관리' },
	{ href: '/teachers', label: '강사 관리' },
	{ href: '/courses', label: '클래스 관리' },
	{ href: '/enrollments', label: '수강 관리' },
	{ href: '/payments', label: '수납' },
	{ href: '/reports', label: '리포트' },
	{ href: '/attendance', label: '출결' },
	{ href: '/makeups', label: '보강' },
	{ href: '/leads', label: '상담·대기' },
	{ href: '/communications', label: '소통' }
] as const;

/** PRD §6.4 — `super_admin` 전용 플랫폼 루트(내비 한 줄) */
export const NAV_LINK_PLATFORM = { href: '/platform', label: '플랫폼' } as const;

/** 원장·전체관리자 — 학원 멤버 초대 */
export const NAV_LINK_SETTINGS = { href: '/settings/members', label: '학원 설정' } as const;

export type AppNavLink =
	| (typeof NAV_LINKS_FULL)[number]
	| (typeof NAV_LINKS_TEACHER)[number]
	| (typeof NAV_LINKS_PARENT)[number]
	| typeof NAV_LINK_PLATFORM
	| typeof NAV_LINK_SETTINGS;

export function navLinksForRole(role: AcademyRole | null): readonly AppNavLink[] {
	if (!role) return [];
	if (role === 'parent') return NAV_LINKS_PARENT.slice();
	if (role === 'teacher') return NAV_LINKS_TEACHER.slice();
	if (role === 'super_admin') {
		return [NAV_LINK_PLATFORM, ...NAV_LINKS_FULL, NAV_LINK_SETTINGS];
	}
	if (role === 'academy_admin') {
		return [...NAV_LINKS_FULL, NAV_LINK_SETTINGS];
	}
	return NAV_LINKS_FULL.slice();
}

/** `/settings/members` — 원장·전체관리자만 */
export function ensureAcademySettingsAccess(locals: App.Locals): AcademyMembershipLocals {
	const m = ensureStaffAcademyMember(locals);
	if (m.role !== 'academy_admin' && m.role !== 'super_admin') {
		error(403, '학원 설정은 원장·전체관리자만 이용할 수 있습니다.');
	}
	return m;
}

function ensureUser(locals: App.Locals): NonNullable<App.Locals['user']> {
	if (!locals.user) error(401, '로그인이 필요합니다.');
	return locals.user;
}

/** 로드 핸들러용: 멤버십 없음·학부모는 예외 */
export function ensureStaffAcademyMember(locals: App.Locals): AcademyMembershipLocals {
	ensureUser(locals);
	if (!locals.academyMembership) {
		error(403, '이 학원에 등록된 멤버십이 없습니다. 관리자에게 문의하세요.');
	}
	if (locals.academyMembership.role === 'parent') {
		error(403, '학부모 계정은 스태프 화면을 이용할 수 없습니다. 내 자녀 메뉴(`/p`)를 이용하세요.');
	}
	return locals.academyMembership;
}

/** PRD §6.4 — `/platform/*` 등 전체관리자 전용 */
export function ensurePlatformSuperAdmin(locals: App.Locals): AcademyMembershipLocals {
	const m = ensureStaffAcademyMember(locals);
	if (m.role !== 'super_admin') {
		error(403, '플랫폼 메뉴는 전체관리자만 이용할 수 있습니다.');
	}
	return m;
}

export function ensureDirectoryAccess(locals: App.Locals): void {
	const m = ensureStaffAcademyMember(locals);
	if (!isElevatedStaffRole(m.role)) {
		error(403, '학생·강사·클래스·수강 관리는 관리자·행정만 이용할 수 있습니다.');
	}
}

export function ensureFinanceAccess(locals: App.Locals): void {
	const m = ensureStaffAcademyMember(locals);
	if (!isElevatedStaffRole(m.role)) {
		error(403, '수납·청구는 관리자·행정만 이용할 수 있습니다.');
	}
}

/** 출결 저장: 관리자·행정 전체, 강사는 담당 클래스(`course.teacherId`)만 */
export function ensureAttendanceWriteForCourse(
	locals: App.Locals,
	courseTeacherId: Types.ObjectId
): void {
	const m = ensureStaffAcademyMember(locals);
	if (isElevatedStaffRole(m.role)) return;
	if (m.role !== 'teacher') error(403, '이 클래스에 대한 권한이 없습니다.');
	if (!m.linkedTeacherId) {
		error(403, '연결된 강사 정보가 없습니다.');
	}
	if (m.linkedTeacherId !== courseTeacherId.toString()) {
		error(403, '담당 클래스만 처리할 수 있습니다.');
	}
}

type GateFail = { ok: false; status: number; message: string };
type GateOk = { ok: true; membership: AcademyMembershipLocals };

function gateStaffMember(locals: App.Locals): GateOk | GateFail {
	if (!locals.user) return { ok: false, status: 401, message: '로그인이 필요합니다.' };
	if (!locals.academyMembership) {
		return {
			ok: false,
			status: 403,
			message: '이 학원에 등록된 멤버십이 없습니다. 관리자에게 문의하세요.'
		};
	}
	if (locals.academyMembership.role === 'parent') {
		return { ok: false, status: 403, message: '학부모 계정에서는 이 작업을 수행할 수 없습니다.' };
	}
	return { ok: true, membership: locals.academyMembership };
}

/** 폼 액션용: 디렉터리(CRUD) 권한 */
export function gateDirectoryAction(locals: App.Locals): GateOk | GateFail {
	const g = gateStaffMember(locals);
	if (!g.ok) return g;
	if (!isElevatedStaffRole(g.membership.role)) {
		return {
			ok: false,
			status: 403,
			message: '학생·강사·클래스·수강 관리는 관리자·행정만 수행할 수 있습니다.'
		};
	}
	return g;
}

export function gateFinanceAction(locals: App.Locals): GateOk | GateFail {
	const g = gateStaffMember(locals);
	if (!g.ok) return g;
	if (!isElevatedStaffRole(g.membership.role)) {
		return { ok: false, status: 403, message: '수납·청구는 관리자·행정만 수행할 수 있습니다.' };
	}
	return g;
}

export function gateCommunicationsAction(locals: App.Locals): GateOk | GateFail {
	const g = gateStaffMember(locals);
	if (!g.ok) return g;
	if (!isElevatedStaffRole(g.membership.role)) {
		return { ok: false, status: 403, message: '공지 발행은 관리자·행정만 수행할 수 있습니다.' };
	}
	return g;
}

export function gateAttendanceWriteAction(
	locals: App.Locals,
	courseTeacherId: Types.ObjectId
): GateOk | GateFail {
	const g = gateStaffMember(locals);
	if (!g.ok) return g;
	const m = g.membership;
	if (isElevatedStaffRole(m.role)) return g;
	if (m.role !== 'teacher')
		return { ok: false, status: 403, message: '이 클래스에 대한 권한이 없습니다.' };
	if (!m.linkedTeacherId) {
		return {
			ok: false,
			status: 403,
			message: '연결된 강사 정보가 없습니다.'
		};
	}
	if (m.linkedTeacherId !== courseTeacherId.toString()) {
		return { ok: false, status: 403, message: '담당 클래스만 처리할 수 있습니다.' };
	}
	return g;
}

export function failFromGate(g: GateFail): ReturnType<typeof fail> {
	return fail(g.status, { error: g.message });
}
