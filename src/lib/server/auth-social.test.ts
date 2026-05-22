import { describe, expect, it } from 'vitest';

import { buildSocialProviders } from './auth-social';

describe('buildSocialProviders', () => {
	it('키가 있는 제공자만 포함', () => {
		const env = {
			KAKAO_CLIENT_ID: 'k-id',
			KAKAO_CLIENT_SECRET: 'k-secret',
			NAVER_CLIENT_ID: '',
			NAVER_CLIENT_SECRET: '',
			GOOGLE_CLIENT_ID: 'g-id',
			GOOGLE_CLIENT_SECRET: 'g-secret'
		};
		const p = buildSocialProviders(env);
		expect(Object.keys(p).sort()).toEqual(['google', 'kakao']);
	});
});
