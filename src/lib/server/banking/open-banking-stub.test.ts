import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchOpenBankingStubTransactions, isOpenBankingConfigured } from './open-banking-stub';

const ENV_KEYS = ['OPEN_BANKING_ENABLED', 'OPEN_BANKING_CLIENT_ID'] as const;

describe('open-banking-stub', () => {
	let saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

	beforeEach(() => {
		saved = {};
		for (const k of ENV_KEYS) {
			saved[k] = process.env[k];
		}
	});

	afterEach(() => {
		for (const k of ENV_KEYS) {
			const v = saved[k];
			if (v === undefined) {
				delete process.env[k];
			} else {
				process.env[k] = v;
			}
		}
	});

	it('when disabled, returns []', () => {
		delete process.env.OPEN_BANKING_ENABLED;
		const from = new Date('2026-01-01T00:00:00.000Z');
		const to = new Date('2026-01-08T00:00:00.000Z');
		expect(fetchOpenBankingStubTransactions({ from, to })).toEqual([]);

		process.env.OPEN_BANKING_ENABLED = 'false';
		expect(fetchOpenBankingStubTransactions({ from, to })).toEqual([]);
	});

	it('when enabled, returns non-empty in range for a deterministic window', () => {
		process.env.OPEN_BANKING_ENABLED = 'true';
		const from = new Date('2026-01-01T00:00:00.000Z');
		const to = new Date('2026-01-08T00:00:00.000Z');
		const rows = fetchOpenBankingStubTransactions({ from, to });
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			expect(Number.isInteger(row.amountKrw)).toBe(true);
			expect(row.amountKrw).toBeGreaterThan(0);
			expect(row.externalId).toMatch(/^stub-\d+-\d+$/);
			const t = row.depositedAt.getTime();
			expect(t).toBeGreaterThanOrEqual(from.getTime());
			expect(t).toBeLessThanOrEqual(to.getTime());
		}
	});

	it('isOpenBankingConfigured', () => {
		delete process.env.OPEN_BANKING_ENABLED;
		delete process.env.OPEN_BANKING_CLIENT_ID;
		expect(isOpenBankingConfigured()).toBe(false);

		process.env.OPEN_BANKING_ENABLED = 'true';
		process.env.OPEN_BANKING_CLIENT_ID = '';
		expect(isOpenBankingConfigured()).toBe(false);

		process.env.OPEN_BANKING_CLIENT_ID = '   ';
		expect(isOpenBankingConfigured()).toBe(false);

		process.env.OPEN_BANKING_CLIENT_ID = 'client-id';
		expect(isOpenBankingConfigured()).toBe(true);
	});
});
