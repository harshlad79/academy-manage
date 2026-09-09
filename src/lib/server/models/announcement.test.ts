import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { ANNOUNCEMENT_BODY_MAX, Announcement } from './announcement';

describe('Announcement schema', () => {
	it('accepts valid announcement', () => {
		const doc = new Announcement({
			academyId: new Types.ObjectId(),
			title: '8월 학부모 안내',
			body: '8월 정기 휴강 안내입니다.',
			createdByUserId: 'testuser'
		});
		const err = doc.validateSync();
		expect(err).toBeUndefined();
		expect(doc.title).toBe('8월 학부모 안내');
	});

	it('rejects missing title·body', () => {
		const doc = new Announcement({
			academyId: new Types.ObjectId(),
			createdByUserId: 'testuser'
		});
		const err = doc.validateSync();
		expect(err).toBeDefined();
		expect(err?.errors['title']).toBeDefined();
		expect(err?.errors['body']).toBeDefined();
	});

	it('enforces body maxlength', () => {
		const doc = new Announcement({
			academyId: new Types.ObjectId(),
			title: 't',
			body: '가'.repeat(ANNOUNCEMENT_BODY_MAX + 1),
			createdByUserId: 'testuser'
		});
		const err = doc.validateSync();
		expect(err?.errors['body']).toBeDefined();
	});
});
