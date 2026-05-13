// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AcademyMembershipLocals } from '$lib/server/rbac';
import type { Session, User } from 'better-auth/types';
import type { Types } from 'mongoose';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: User | null;
			session: Session | null;
			/** 기본 학원(`DEV_ACADEMY_ID`)에 대한 Better Auth `user.id` 멤버십(다학원 전환 시 활성 학원 기준으로 확장 예정) */
			academyMembership: AcademyMembershipLocals | null;
			/** `resolveActiveAcademyContext` 가 고른 활성 학원(멤버십이 있을 때만 설정) */
			activeAcademyId?: Types.ObjectId;
			/** 활성 맥락 학원의 운영 상태(스태프 가드·UI) */
			academyOperationalStatus?: 'active' | 'inactive';
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
