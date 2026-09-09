import { describe, expect, it } from 'vitest';

import {
	suggestDepositMatches,
	type DepositForMatching,
	type InvoiceLineForMatching
} from './deposit-matching';

const line = (over: Partial<InvoiceLineForMatching> = {}): InvoiceLineForMatching => ({
	id: 'line-1',
	enrollmentId: 'enr-1',
	studentName: '김철수',
	courseName: '수학심화',
	amountKrw: 120_000,
	description: '6월 수강료',
	dueDate: '2026-06-25',
	status: 'open',
	paidAt: null,
	...over
});

const deposit = (over: Partial<DepositForMatching> = {}): DepositForMatching => ({
	id: 'dep-1',
	amountKrw: 120_000,
	depositedAt: '2026-06-20T12:00:00.000Z',
	memo: null,
	...over
});

describe('suggestDepositMatches', () => {
	it('동일 금액 미납 청구가 없으면 제안 없음', () => {
		const r = suggestDepositMatches([deposit()], [line({ amountKrw: 95_000 })]);
		expect(r).toEqual([]);
	});

	it('후보가 하나면 medium 제안', () => {
		const r = suggestDepositMatches([deposit()], [line()]);
		expect(r).toEqual([
			{ depositId: 'dep-1', invoiceLineId: 'line-1', confidence: 'medium', candidateCount: 1 }
		]);
	});

	it('입금 표시에 학생명이 있으면 high 제안', () => {
		const r = suggestDepositMatches(
			[deposit({ memo: '김철수 6월 수강료' })],
			[line(), line({ id: 'line-2', enrollmentId: 'enr-2', studentName: '박영희' })]
		);
		expect(r).toEqual([
			{ depositId: 'dep-1', invoiceLineId: 'line-1', confidence: 'high', candidateCount: 2 }
		]);
	});

	it('후보 여러 개 + 표시 불일치면 제안 없음(수동 대기)', () => {
		const r = suggestDepositMatches(
			[deposit()],
			[line(), line({ id: 'line-2', enrollmentId: 'enr-2', studentName: '박영희' })]
		);
		expect(r).toEqual([]);
	});

	it('paid 청구는 후보에서 제외', () => {
		const r = suggestDepositMatches(
			[deposit()],
			[line({ status: 'paid', paidAt: '2026-06-21T00:00:00.000Z' })]
		);
		expect(r).toEqual([]);
	});
});
