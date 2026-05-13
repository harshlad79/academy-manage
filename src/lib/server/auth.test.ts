import { describe, it, expect } from 'vitest';
import { getAuth, isMockAuthMode, liveBetterAuthUserExists } from './auth';

describe('Auth Toggle', () => {
	it('mock 모드에서 고정 테스트 사용자를 반환한다', async () => {
		expect(isMockAuthMode()).toBe(true);
		const session = await getAuth().api.getSession({ headers: new Headers() });
		expect(session?.user?.name).toBe('테스트 사용자');
		expect(session?.user?.id).toBe('testuser');
	});

	it('mock 모드에서 liveBetterAuthUserExists 는 항상 true', async () => {
		expect(await liveBetterAuthUserExists('any-id')).toBe(true);
	});
});
