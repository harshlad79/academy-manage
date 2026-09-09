import type { AcademyDoc } from './models/academy';

/**
 * PRD §6.6 학원 단 기능 플래그 게이트.
 * 레거시 문서는 필드가 없을 수 있으므로 null·undefined는 기본값(true)과 동일하게 취급한다.
 */
export function academyAllowsParentPortal(
	academy:
		| Pick<AcademyDoc, 'parentPortalEnabled'>
		| { parentPortalEnabled?: boolean }
		| null
		| undefined
): boolean {
	return academy?.parentPortalEnabled !== false;
}

export function academyAllowsCommunications(
	academy:
		| Pick<AcademyDoc, 'communicationsEnabled'>
		| { communicationsEnabled?: boolean }
		| null
		| undefined
): boolean {
	return academy?.communicationsEnabled !== false;
}
