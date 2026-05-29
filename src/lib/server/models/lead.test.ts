import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { LEAD_SOURCES, LEAD_STATUSES, Lead } from './lead';

describe('Lead', () => {
	it('exports expected statuses without enrolled', () => {
		expect(LEAD_STATUSES).toEqual(['new', 'contacted', 'waitlisted', 'converted', 'closed']);
	});

	it('accepts required fields with default status new', () => {
		const doc = new Lead({
			academyId: new Types.ObjectId(),
			studentName: '김학생',
			guardianName: '김보호',
			phone: '010-1234-5678',
			source: 'web'
		});
		const err = doc.validateSync();
		expect(err).toBeUndefined();
		expect(doc.status).toBe('new');
		expect(doc.phone).toBe('01012345678');
	});

	it('normalizes phone via setter', () => {
		const doc = new Lead({
			academyId: new Types.ObjectId(),
			studentName: 'A',
			guardianName: 'B',
			phone: '+82 10-9876-5432',
			source: 'staff'
		});
		expect(doc.phone).toBe('01098765432');
		expect(doc.source).toBe('staff');
	});

	it('rejects invalid phone on validateSync', () => {
		const doc = new Lead({
			academyId: new Types.ObjectId(),
			studentName: 'A',
			guardianName: 'B',
			phone: '0111234567',
			source: 'web'
		});
		const err = doc.validateSync();
		expect(err?.errors.phone).toBeDefined();
	});

	it('rejects unknown status', () => {
		const doc = new Lead({
			academyId: new Types.ObjectId(),
			studentName: 'A',
			guardianName: 'B',
			phone: '01012345678',
			source: 'web',
			status: 'enrolled'
		});
		const err = doc.validateSync();
		expect(err).toBeDefined();
	});

	it('rejects unknown source', () => {
		const doc = new Lead({
			academyId: new Types.ObjectId(),
			studentName: 'A',
			guardianName: 'B',
			phone: '01012345678',
			source: 'referral'
		});
		const err = doc.validateSync();
		expect(err).toBeDefined();
	});

	it('accepts all status and source enum values', () => {
		for (const status of LEAD_STATUSES) {
			const doc = new Lead({
				academyId: new Types.ObjectId(),
				studentName: 'A',
				guardianName: 'B',
				phone: '01012345678',
				source: 'web',
				status
			});
			expect(doc.validateSync()).toBeUndefined();
		}
		for (const source of LEAD_SOURCES) {
			const doc = new Lead({
				academyId: new Types.ObjectId(),
				studentName: 'A',
				guardianName: 'B',
				phone: '01012345678',
				source
			});
			expect(doc.validateSync()).toBeUndefined();
		}
	});

	it('defines academyId+status+createdAt and academyId+phone indexes', () => {
		const indexes = Lead.schema.indexes().map((idx) => idx[0]);
		expect(indexes).toContainEqual({ academyId: 1, status: 1, createdAt: -1 });
		expect(indexes).toContainEqual({ academyId: 1, phone: 1 });
	});
});
