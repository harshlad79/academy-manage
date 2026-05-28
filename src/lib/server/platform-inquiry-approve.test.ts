import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

import {
	approveInquiryToActive,
	approveInquiryToTrial,
	PlatformInquiryApproveError
} from './platform-inquiry-approve';

const mocks = vi.hoisted(() => ({
	inquiryFindById: vi.fn(),
	academyCreate: vi.fn(),
	academyFindById: vi.fn(),
	academyFindByIdAndUpdate: vi.fn(),
	academyUpdateOne: vi.fn(),
	inviteCreate: vi.fn(),
	inviteDeleteOne: vi.fn(),
	academyDeleteOne: vi.fn(),
	generateInviteToken: vi.fn(() => 'invite-token-hex'),
	defaultInviteExpiresAt: vi.fn(() => new Date('2026-06-15T00:00:00Z'))
}));

vi.mock('./models/academy-inquiry', () => ({
	AcademyInquiry: {
		findById: (...args: unknown[]) => mocks.inquiryFindById(...args)
	}
}));

vi.mock('./models/academy', () => ({
	Academy: {
		create: (...args: unknown[]) => mocks.academyCreate(...args),
		findById: (...args: unknown[]) => mocks.academyFindById(...args),
		findByIdAndUpdate: (...args: unknown[]) => mocks.academyFindByIdAndUpdate(...args),
		updateOne: (...args: unknown[]) => mocks.academyUpdateOne(...args),
		deleteOne: (...args: unknown[]) => mocks.academyDeleteOne(...args)
	}
}));

vi.mock('./models/academy-invite', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./models/academy-invite')>();
	return {
		...actual,
		AcademyInvite: {
			create: (...args: unknown[]) => mocks.inviteCreate(...args),
			deleteOne: (...args: unknown[]) => mocks.inviteDeleteOne(...args)
		},
		generateInviteToken: () => mocks.generateInviteToken(),
		defaultInviteExpiresAt: () => mocks.defaultInviteExpiresAt()
	};
});

function makeInquiry(overrides: Record<string, unknown> = {}) {
	const _id = new Types.ObjectId();
	return {
		_id,
		academyName: '테스트 학원',
		contactName: '홍길동',
		phone: '01012345678',
		email: 'owner@example.com',
		region: '서울',
		status: 'new',
		save: vi.fn().mockResolvedValue(undefined),
		...overrides
	};
}

describe('approveInquiryToTrial', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.academyDeleteOne.mockResolvedValue({ deletedCount: 1 });
		mocks.inviteDeleteOne.mockResolvedValue({ deletedCount: 1 });
	});

	it('creates trial academy, admin invite, and updates inquiry', async () => {
		const inquiryId = new Types.ObjectId();
		const academyId = new Types.ObjectId();
		const inviteId = new Types.ObjectId();
		const inquiry = makeInquiry({ _id: inquiryId, status: 'contacted' });

		mocks.inquiryFindById.mockResolvedValue(inquiry);
		mocks.academyCreate.mockResolvedValue({
			_id: academyId,
			name: '테스트 학원',
			status: 'trial',
			trialEndsAt: new Date('2026-06-08T00:00:00Z')
		});
		mocks.inviteCreate.mockResolvedValue({
			_id: inviteId,
			academyId,
			email: 'owner@example.com',
			role: 'academy_admin',
			token: 'invite-token-hex',
			expiresAt: new Date('2026-06-15T00:00:00Z')
		});

		const result = await approveInquiryToTrial({
			inquiryId,
			processedByUserId: 'platform-user-1',
			trialDays: 7
		});

		expect(mocks.academyCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				name: '테스트 학원',
				status: 'trial',
				trialEndsAt: expect.any(Date)
			})
		);
		expect(mocks.inviteCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				academyId,
				email: 'owner@example.com',
				role: 'academy_admin',
				token: 'invite-token-hex',
				expiresAt: new Date('2026-06-15T00:00:00Z'),
				createdByUserId: 'platform-user-1'
			})
		);
		expect(inquiry.status).toBe('trial');
		expect(inquiry.academyId).toEqual(academyId);
		expect(inquiry.trialDays).toBe(7);
		expect(inquiry.processedByUserId).toBe('platform-user-1');
		expect(inquiry.processedAt).toBeInstanceOf(Date);
		expect(inquiry.save).toHaveBeenCalledOnce();
		expect(result.academy.status).toBe('trial');
		expect(result.invite.role).toBe('academy_admin');
	});

	it('defaults trialDays to 7', async () => {
		const inquiryId = new Types.ObjectId();
		const inquiry = makeInquiry({ _id: inquiryId });
		mocks.inquiryFindById.mockResolvedValue(inquiry);
		mocks.academyCreate.mockImplementation(async (payload: { trialEndsAt: Date }) => ({
			_id: new Types.ObjectId(),
			...payload
		}));
		mocks.inviteCreate.mockResolvedValue({ _id: new Types.ObjectId() });

		const before = Date.now();
		await approveInquiryToTrial({
			inquiryId,
			processedByUserId: 'u1'
		});
		const after = Date.now();

		const created = mocks.academyCreate.mock.calls[0][0] as { trialEndsAt: Date };
		const msPerDay = 24 * 60 * 60 * 1000;
		const days = Math.round((created.trialEndsAt.getTime() - before) / msPerDay);
		expect(days).toBeGreaterThanOrEqual(6);
		expect(days).toBeLessThanOrEqual(8);
		expect(inquiry.trialDays).toBe(7);
		expect(after).toBeGreaterThanOrEqual(before);
	});

	it('uses academyName override when provided', async () => {
		const inquiry = makeInquiry();
		mocks.inquiryFindById.mockResolvedValue(inquiry);
		mocks.academyCreate.mockResolvedValue({ _id: new Types.ObjectId(), status: 'trial' });
		mocks.inviteCreate.mockResolvedValue({ _id: new Types.ObjectId() });

		await approveInquiryToTrial({
			inquiryId: inquiry._id,
			processedByUserId: 'u1',
			academyName: '  새 학원명  '
		});

		expect(mocks.academyCreate).toHaveBeenCalledWith(
			expect.objectContaining({ name: '새 학원명' })
		);
	});

	it('rejects inquiry not in new or contacted', async () => {
		const inquiry = makeInquiry({ status: 'trial' });
		mocks.inquiryFindById.mockResolvedValue(inquiry);

		await expect(
			approveInquiryToTrial({
				inquiryId: inquiry._id,
				processedByUserId: 'u1'
			})
		).rejects.toMatchObject({
			code: 'inquiry_invalid_status'
		} satisfies Partial<PlatformInquiryApproveError>);
		expect(mocks.academyCreate).not.toHaveBeenCalled();
	});

	it('rolls back academy and invite when inquiry save fails', async () => {
		const academyId = new Types.ObjectId();
		const inviteId = new Types.ObjectId();
		const inquiry = makeInquiry();
		inquiry.save.mockRejectedValue(new Error('save failed'));

		mocks.inquiryFindById.mockResolvedValue(inquiry);
		mocks.academyCreate.mockResolvedValue({ _id: academyId });
		mocks.inviteCreate.mockResolvedValue({ _id: inviteId });

		await expect(
			approveInquiryToTrial({
				inquiryId: inquiry._id,
				processedByUserId: 'u1'
			})
		).rejects.toThrow('save failed');

		expect(mocks.inviteDeleteOne).toHaveBeenCalledWith({ _id: inviteId });
		expect(mocks.academyDeleteOne).toHaveBeenCalledWith({ _id: academyId });
	});
});

describe('approveInquiryToActive', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.academyUpdateOne.mockResolvedValue({ modifiedCount: 1 });
	});

	it('activates academy and marks inquiry approved', async () => {
		const inquiryId = new Types.ObjectId();
		const academyId = new Types.ObjectId();
		const inquiry = makeInquiry({
			_id: inquiryId,
			status: 'trial',
			academyId
		});

		mocks.inquiryFindById.mockResolvedValue(inquiry);
		mocks.academyFindById.mockReturnValue({
			lean: vi.fn().mockResolvedValue({
				_id: academyId,
				status: 'trial',
				trialEndsAt: new Date('2026-06-01')
			})
		});
		mocks.academyFindByIdAndUpdate.mockResolvedValue({
			_id: academyId,
			name: '테스트 학원',
			status: 'active'
		});

		const result = await approveInquiryToActive({
			inquiryId,
			processedByUserId: 'platform-user-2'
		});

		expect(mocks.academyFindByIdAndUpdate).toHaveBeenCalledWith(
			academyId,
			{ $set: { status: 'active' }, $unset: { trialEndsAt: '' } },
			{ new: true }
		);
		expect(inquiry.status).toBe('approved');
		expect(inquiry.processedByUserId).toBe('platform-user-2');
		expect(inquiry.processedAt).toBeInstanceOf(Date);
		expect(result.academy.status).toBe('active');
	});

	it('rejects when inquiry is not trial with academyId', async () => {
		const inquiry = makeInquiry({ status: 'new' });
		mocks.inquiryFindById.mockResolvedValue(inquiry);

		await expect(
			approveInquiryToActive({
				inquiryId: inquiry._id,
				processedByUserId: 'u1'
			})
		).rejects.toMatchObject({ code: 'inquiry_invalid_status' });
		expect(mocks.academyFindByIdAndUpdate).not.toHaveBeenCalled();
	});

	it('rolls back academy when inquiry save fails', async () => {
		const academyId = new Types.ObjectId();
		const inquiry = makeInquiry({ status: 'trial', academyId });
		inquiry.save.mockRejectedValue(new Error('inquiry save failed'));

		mocks.inquiryFindById.mockResolvedValue(inquiry);
		mocks.academyFindById.mockReturnValue({
			lean: vi.fn().mockResolvedValue({
				_id: academyId,
				status: 'trial',
				trialEndsAt: new Date('2026-06-01')
			})
		});
		mocks.academyFindByIdAndUpdate.mockResolvedValue({
			_id: academyId,
			status: 'active'
		});

		await expect(
			approveInquiryToActive({
				inquiryId: inquiry._id,
				processedByUserId: 'u1'
			})
		).rejects.toThrow('inquiry save failed');

		expect(mocks.academyUpdateOne).toHaveBeenCalledWith(
			{ _id: academyId },
			expect.objectContaining({
				$set: expect.objectContaining({ status: 'trial', trialEndsAt: new Date('2026-06-01') })
			})
		);
	});
});
