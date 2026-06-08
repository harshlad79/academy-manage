import { Types } from 'mongoose';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/server/models/parent-student-link', () => ({
	ParentStudentLink: { find: vi.fn() }
}));
vi.mock('$lib/server/user-profile-read', () => ({
	readUserProfileNotifyFields: vi.fn()
}));

import { ParentStudentLink } from '$lib/server/models/parent-student-link';
import { readUserProfileNotifyFields } from '$lib/server/user-profile-read';
import {
	resolvePaymentNotifyEmailRecipients,
	resolvePaymentNotifyPushRecipients,
	resolvePaymentNotifySmsRecipients
} from './parent-notify-recipient';

describe('resolvePaymentNotifySmsRecipients', () => {
	const academyId = new Types.ObjectId();
	const studentId = new Types.ObjectId();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('연결·동의·번호가 있으면 수신자 반환', async () => {
		vi.mocked(ParentStudentLink.find).mockReturnValue({
			lean: vi.fn().mockResolvedValue([{ parentUserId: 'parent-1' }])
		} as never);
		vi.mocked(readUserProfileNotifyFields).mockResolvedValue({
			phone: '01011112222',
			smsMarketingConsentAt: new Date(),
			email: null,
			emailNotifyConsentAt: null,
			pushNotifyConsentAt: null,
			pushSubscriptionEndpoint: null
		});

		const r = await resolvePaymentNotifySmsRecipients(academyId, studentId);
		expect(r).toEqual({
			ok: true,
			recipients: [{ to: '01011112222', parentUserId: 'parent-1' }]
		});
	});
});

describe('resolvePaymentNotifyEmailRecipients', () => {
	const academyId = new Types.ObjectId();
	const studentId = new Types.ObjectId();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('이메일 동의·주소가 있으면 수신자 반환', async () => {
		vi.mocked(ParentStudentLink.find).mockReturnValue({
			lean: vi.fn().mockResolvedValue([{ parentUserId: 'parent-1' }])
		} as never);
		vi.mocked(readUserProfileNotifyFields).mockResolvedValue({
			phone: null,
			smsMarketingConsentAt: null,
			email: 'parent@example.com',
			emailNotifyConsentAt: new Date(),
			pushNotifyConsentAt: null,
			pushSubscriptionEndpoint: null
		});

		const r = await resolvePaymentNotifyEmailRecipients(academyId, studentId);
		expect(r).toEqual({
			ok: true,
			recipients: [{ to: 'parent@example.com', parentUserId: 'parent-1' }]
		});
	});

	it('동의 없으면 no_consent', async () => {
		vi.mocked(ParentStudentLink.find).mockReturnValue({
			lean: vi.fn().mockResolvedValue([{ parentUserId: 'parent-1' }])
		} as never);
		vi.mocked(readUserProfileNotifyFields).mockResolvedValue({
			phone: null,
			smsMarketingConsentAt: null,
			email: 'parent@example.com',
			emailNotifyConsentAt: null,
			pushNotifyConsentAt: null,
			pushSubscriptionEndpoint: null
		});

		const r = await resolvePaymentNotifyEmailRecipients(academyId, studentId);
		expect(r).toEqual({ ok: false, reason: 'no_consent' });
	});
});

describe('resolvePaymentNotifyPushRecipients', () => {
	const academyId = new Types.ObjectId();
	const studentId = new Types.ObjectId();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('푸시 동의·구독 ID가 있으면 수신자 반환', async () => {
		vi.mocked(ParentStudentLink.find).mockReturnValue({
			lean: vi.fn().mockResolvedValue([{ parentUserId: 'parent-1' }])
		} as never);
		vi.mocked(readUserProfileNotifyFields).mockResolvedValue({
			phone: null,
			smsMarketingConsentAt: null,
			email: null,
			emailNotifyConsentAt: null,
			pushNotifyConsentAt: new Date(),
			pushSubscriptionEndpoint: 'https://push.stub/endpoint-1'
		});

		const r = await resolvePaymentNotifyPushRecipients(academyId, studentId);
		expect(r).toEqual({
			ok: true,
			recipients: [{ endpoint: 'https://push.stub/endpoint-1', parentUserId: 'parent-1' }]
		});
	});
});
