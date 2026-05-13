import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import type { Session, User } from 'better-auth/types';
import {
	gateAttendanceWriteAction,
	gateDirectoryAction,
	gateFinanceAction,
	isElevatedStaffRole,
	navLinksForRole,
	type AcademyMembershipLocals
} from './rbac';

function mockUser(): User {
	return {
		id: 'u1',
		name: 'U',
		email: 'u@ex.com',
		emailVerified: true,
		image: undefined,
		createdAt: new Date(),
		updatedAt: new Date()
	} as User;
}

function mockSession(): Session {
	return {
		id: 's1',
		userId: 'u1',
		expiresAt: new Date(),
		createdAt: new Date(),
		updatedAt: new Date(),
		token: 't'
	} as Session;
}

function localsWithMembership(m: AcademyMembershipLocals | null): App.Locals {
	return {
		user: mockUser(),
		session: mockSession(),
		academyMembership: m
	};
}

describe('rbac', () => {
	it('elevated 역할 판별', () => {
		expect(isElevatedStaffRole('academy_admin')).toBe(true);
		expect(isElevatedStaffRole('office')).toBe(true);
		expect(isElevatedStaffRole('super_admin')).toBe(true);
		expect(isElevatedStaffRole('teacher')).toBe(false);
		expect(isElevatedStaffRole('parent')).toBe(false);
	});

	it('강사 내비는 대시보드·리포트·보강·출결·소통', () => {
		const links = navLinksForRole('teacher').map((l) => l.href);
		expect([...links]).toEqual(['/', '/reports', '/makeups', '/attendance', '/communications']);
	});

	it('전체관리자 내비는 플랫폼 링크가 맨 앞', () => {
		const links = navLinksForRole('super_admin');
		expect(links[0]).toEqual({ href: '/platform', label: '플랫폼' });
		expect(links.map((l) => l.href).includes('/students')).toBe(true);
	});

	it('학원 관리자 내비에 플랫폼 링크는 없다', () => {
		const hrefs = navLinksForRole('academy_admin').map((l) => l.href);
		expect(hrefs.includes('/platform')).toBe(false);
		expect(hrefs[0]).toBe('/');
	});

	it('학부모 내비는 학부모 포털 `/p` 하나', () => {
		expect(navLinksForRole('parent')).toEqual([{ href: '/p', label: '내 자녀' }]);
	});

	it('관리자는 디렉터리·수납 액션 가능', () => {
		const l = localsWithMembership({ role: 'academy_admin', linkedTeacherId: null });
		expect(gateDirectoryAction(l)).toMatchObject({ ok: true });
		expect(gateFinanceAction(l)).toMatchObject({ ok: true });
	});

	it('강사는 디렉터리·수납 액션 불가, 담당 반 출결만 가능', () => {
		const tid = new Types.ObjectId();
		const l = localsWithMembership({ role: 'teacher', linkedTeacherId: tid.toString() });
		expect(gateDirectoryAction(l).ok).toBe(false);
		expect(gateFinanceAction(l).ok).toBe(false);

		const otherTeacher = new Types.ObjectId();
		const ownCourseTeacher = tid;
		expect(gateAttendanceWriteAction(l, otherTeacher).ok).toBe(false);
		expect(gateAttendanceWriteAction(l, ownCourseTeacher).ok).toBe(true);
	});
});
