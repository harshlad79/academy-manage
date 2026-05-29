import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncLeadEnrolledAt } from './lead-enrolled-at';

const mocks = vi.hoisted(() => ({
	updateOne: vi.fn()
}));

vi.mock('$lib/server/models/lead', () => ({
	Lead: {
		updateOne: (...args: unknown[]) => mocks.updateOne(...args)
	}
}));

describe('syncLeadEnrolledAt', () => {
	const academyId = new Types.ObjectId();
	const studentId = new Types.ObjectId();

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
	});

	it('sets enrolledAt on lead matching studentId when enrolledAt is absent', async () => {
		const at = new Date('2026-05-28T12:00:00Z');
		await syncLeadEnrolledAt({ academyId, studentId, at });

		expect(mocks.updateOne).toHaveBeenCalledOnce();
		expect(mocks.updateOne).toHaveBeenCalledWith(
			{
				academyId,
				studentId,
				enrolledAt: { $exists: false }
			},
			{ $set: { enrolledAt: at } }
		);
	});

	it('uses current date when at is omitted', async () => {
		const before = Date.now();
		await syncLeadEnrolledAt({ academyId, studentId });
		const after = Date.now();

		const setArg = mocks.updateOne.mock.calls[0]?.[1] as { $set: { enrolledAt: Date } };
		const enrolledAt = setArg.$set.enrolledAt.getTime();
		expect(enrolledAt).toBeGreaterThanOrEqual(before);
		expect(enrolledAt).toBeLessThanOrEqual(after);
	});

	it('does not overwrite when enrolledAt already exists (filter excludes set leads)', async () => {
		mocks.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
		await syncLeadEnrolledAt({ academyId, studentId, at: new Date('2026-01-01T00:00:00Z') });

		expect(mocks.updateOne).toHaveBeenCalledWith(
			expect.objectContaining({ enrolledAt: { $exists: false } }),
			expect.any(Object)
		);
	});
});
