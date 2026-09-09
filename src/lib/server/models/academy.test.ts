import { describe, expect, it } from 'vitest';
import { Academy } from './academy';

describe('Academy schema', () => {
	it('accepts trial status with trialEndsAt', () => {
		const doc = new Academy({
			name: 'Test',
			status: 'trial',
			trialEndsAt: new Date('2026-06-01')
		});
		const err = doc.validateSync();
		expect(err).toBeUndefined();
		expect(doc.status).toBe('trial');
	});

	it('defaults feature flags per PRD §6.6', () => {
		const doc = new Academy({ name: 'Test', status: 'active' });
		const err = doc.validateSync();
		expect(err).toBeUndefined();
		expect(doc.billingAutoImport).toBe(false);
		expect(doc.parentPortalEnabled).toBe(true);
		expect(doc.communicationsEnabled).toBe(true);
	});
});
