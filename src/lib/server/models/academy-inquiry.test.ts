import { describe, expect, it } from 'vitest';

import { AcademyInquiry, validateAcademyInquiryCreateInput } from './academy-inquiry';

describe('AcademyInquiry schema', () => {
	it('accepts required fields with default status new', () => {
		const doc = new AcademyInquiry({
			academyName: '테스트 학원',
			contactName: '홍길동',
			phone: '010-1234-5678',
			email: 'Owner@Example.COM',
			region: '서울 강남'
		});
		const err = doc.validateSync();
		expect(err).toBeUndefined();
		expect(doc.status).toBe('new');
		expect(doc.phone).toBe('01012345678');
		expect(doc.email).toBe('owner@example.com');
	});

	it('normalizes phone and email via setters', () => {
		const doc = new AcademyInquiry({
			academyName: 'A',
			contactName: 'B',
			phone: '+82 10-9876-5432',
			email: '  User@Test.co  ',
			region: '부산'
		});
		expect(doc.phone).toBe('01098765432');
		expect(doc.email).toBe('user@test.co');
	});

	it('rejects invalid phone on validateSync', () => {
		const doc = new AcademyInquiry({
			academyName: 'A',
			contactName: 'B',
			phone: '0111234567',
			email: 'a@b.co',
			region: '서울'
		});
		const err = doc.validateSync();
		expect(err?.errors.phone).toBeDefined();
	});

	it('rejects invalid email on validateSync', () => {
		const doc = new AcademyInquiry({
			academyName: 'A',
			contactName: 'B',
			phone: '01012345678',
			email: 'not-email',
			region: '서울'
		});
		const err = doc.validateSync();
		expect(err?.errors.email).toBeDefined();
	});

	it('accepts optional memo, trialDays, and processed fields', () => {
		const doc = new AcademyInquiry({
			academyName: 'A',
			contactName: 'B',
			phone: '01012345678',
			email: 'a@b.co',
			region: '서울',
			memo: '  문의 메모  ',
			status: 'trial',
			trialDays: 14,
			processedByUserId: 'user-1',
			processedAt: new Date('2026-05-01')
		});
		const err = doc.validateSync();
		expect(err).toBeUndefined();
		expect(doc.memo).toBe('문의 메모');
		expect(doc.status).toBe('trial');
		expect(doc.trialDays).toBe(14);
		expect(doc.processedByUserId).toBe('user-1');
	});

	it('rejects unknown status', () => {
		const doc = new AcademyInquiry({
			academyName: 'A',
			contactName: 'B',
			phone: '01012345678',
			email: 'a@b.co',
			region: '서울',
			status: 'pending'
		});
		const err = doc.validateSync();
		expect(err).toBeDefined();
	});
});

describe('validateAcademyInquiryCreateInput', () => {
	it('returns normalized fields when valid', () => {
		const r = validateAcademyInquiryCreateInput({
			academyName: '  학원  ',
			contactName: ' 담당 ',
			phone: '010-1111-2222',
			email: 'X@Y.co',
			region: ' 대구 ',
			memo: ' 메모 '
		});
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.fields).toEqual({
				academyName: '학원',
				contactName: '담당',
				phone: '01011112222',
				email: 'x@y.co',
				region: '대구',
				memo: '메모'
			});
		}
	});

	it('rejects empty required strings', () => {
		expect(
			validateAcademyInquiryCreateInput({
				academyName: '   ',
				contactName: 'B',
				phone: '01012345678',
				email: 'a@b.co',
				region: '서울'
			}).ok
		).toBe(false);
	});

	it('rejects invalid phone and email', () => {
		expect(
			validateAcademyInquiryCreateInput({
				academyName: 'A',
				contactName: 'B',
				phone: 'bad',
				email: 'a@b.co',
				region: '서울'
			}).ok
		).toBe(false);
		expect(
			validateAcademyInquiryCreateInput({
				academyName: 'A',
				contactName: 'B',
				phone: '01012345678',
				email: 'bad',
				region: '서울'
			}).ok
		).toBe(false);
	});
});
