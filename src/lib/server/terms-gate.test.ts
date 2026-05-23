import { describe, expect, it } from 'vitest';

import { needsTermsAcceptance, shouldSkipTermsGate } from './terms-gate';

describe('shouldSkipTermsGate', () => {
	it('auth 경로는 스킵', () => {
		expect(shouldSkipTermsGate('/auth/sign-in')).toBe(true);
		expect(shouldSkipTermsGate('/api/auth/callback/kakao')).toBe(true);
	});
	it('invite accept 공개 경로 스킵', () => {
		expect(shouldSkipTermsGate('/invite/accept')).toBe(true);
	});
});

describe('needsTermsAcceptance', () => {
	it('termsAcceptedAt 없으면 true', () => {
		expect(needsTermsAcceptance({ termsAcceptedAt: null })).toBe(true);
	});
	it('있으면 false', () => {
		expect(needsTermsAcceptance({ termsAcceptedAt: new Date() })).toBe(false);
	});
});
