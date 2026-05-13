import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { isPopulatedIdName, isPopulatedTeacherLean } from './mongo-populate-guards';

describe('mongo-populate-guards', () => {
	it('isPopulatedIdName는 _id+name 문서만 통과', () => {
		const id = new Types.ObjectId();
		expect(isPopulatedIdName({ _id: id, name: 'Kim' })).toBe(true);
		expect(isPopulatedIdName({ _id: id, name: 'Kim', grade: '고1' })).toBe(true);
	});

	it('isPopulatedIdName는 ObjectId 단일 값은 거부', () => {
		expect(isPopulatedIdName(new Types.ObjectId())).toBe(false);
	});

	it('isPopulatedIdName는 미채움/깨진 형태 거부', () => {
		expect(isPopulatedIdName(null)).toBe(false);
		expect(isPopulatedIdName({ name: 'x' })).toBe(false);
		expect(isPopulatedIdName({ _id: new Types.ObjectId() })).toBe(false);
		expect(isPopulatedIdName({ _id: 'not-oid', name: 'x' })).toBe(false);
	});

	it('isPopulatedTeacherLean는 강사 lean과 호환', () => {
		expect(isPopulatedTeacherLean({ _id: new Types.ObjectId(), name: 'T', subject: '수학' })).toBe(
			true
		);
	});
});
