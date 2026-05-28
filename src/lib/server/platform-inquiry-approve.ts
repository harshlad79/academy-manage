import type { Types } from 'mongoose';

import { Academy, type AcademyDoc } from './models/academy';
import { AcademyInquiry, type AcademyInquiryDoc } from './models/academy-inquiry';
import {
	AcademyInvite,
	defaultInviteExpiresAt,
	generateInviteToken,
	type AcademyInviteDoc
} from './models/academy-invite';

const DEFAULT_TRIAL_DAYS = 7;
const TRIAL_APPROVABLE_STATUSES = ['new', 'contacted'] as const;

export type PlatformInquiryApproveErrorCode =
	| 'inquiry_not_found'
	| 'inquiry_invalid_status'
	| 'academy_not_found';

export class PlatformInquiryApproveError extends Error {
	constructor(
		message: string,
		readonly code: PlatformInquiryApproveErrorCode
	) {
		super(message);
		this.name = 'PlatformInquiryApproveError';
	}
}

export type ApproveInquiryToTrialResult = {
	academy: AcademyDoc & { _id: Types.ObjectId };
	invite: AcademyInviteDoc & { _id: Types.ObjectId };
	inquiry: AcademyInquiryDoc & { _id: Types.ObjectId };
};

export type ApproveInquiryToActiveResult = {
	academy: AcademyDoc & { _id: Types.ObjectId };
	inquiry: AcademyInquiryDoc & { _id: Types.ObjectId };
};

function addDays(from: Date, days: number): Date {
	const d = new Date(from);
	d.setDate(d.getDate() + days);
	return d;
}

export async function approveInquiryToTrial(options: {
	inquiryId: Types.ObjectId;
	trialDays?: number;
	processedByUserId: string;
	academyName?: string;
}): Promise<ApproveInquiryToTrialResult> {
	const trialDays = options.trialDays ?? DEFAULT_TRIAL_DAYS;
	if (trialDays < 1) {
		throw new PlatformInquiryApproveError(
			'체험 기간은 1일 이상이어야 합니다.',
			'inquiry_invalid_status'
		);
	}

	const inquiry = await AcademyInquiry.findById(options.inquiryId);
	if (!inquiry) {
		throw new PlatformInquiryApproveError('문의를 찾을 수 없습니다.', 'inquiry_not_found');
	}
	if (
		!TRIAL_APPROVABLE_STATUSES.includes(
			inquiry.status as (typeof TRIAL_APPROVABLE_STATUSES)[number]
		)
	) {
		throw new PlatformInquiryApproveError(
			'신규·연락 완료 상태의 문의만 체험 승인할 수 있습니다.',
			'inquiry_invalid_status'
		);
	}

	const now = new Date();
	const trialEndsAt = addDays(now, trialDays);
	const academyName = options.academyName?.trim() || inquiry.academyName;

	let academy: (AcademyDoc & { _id: Types.ObjectId }) | null = null;
	let invite: (AcademyInviteDoc & { _id: Types.ObjectId }) | null = null;

	try {
		academy = (await Academy.create({
			name: academyName,
			status: 'trial',
			trialEndsAt
		})) as AcademyDoc & { _id: Types.ObjectId };

		invite = (await AcademyInvite.create({
			academyId: academy._id,
			email: inquiry.email,
			role: 'academy_admin',
			token: generateInviteToken(),
			expiresAt: defaultInviteExpiresAt(),
			createdByUserId: options.processedByUserId
		})) as AcademyInviteDoc & { _id: Types.ObjectId };

		inquiry.status = 'trial';
		inquiry.academyId = academy._id;
		inquiry.trialDays = trialDays;
		inquiry.processedByUserId = options.processedByUserId;
		inquiry.processedAt = now;
		await inquiry.save();

		return { academy, invite, inquiry: inquiry as AcademyInquiryDoc & { _id: Types.ObjectId } };
	} catch (err) {
		if (invite) {
			await AcademyInvite.deleteOne({ _id: invite._id }).catch(() => undefined);
		}
		if (academy) {
			await Academy.deleteOne({ _id: academy._id }).catch(() => undefined);
		}
		throw err;
	}
}

export async function approveInquiryToActive(options: {
	inquiryId: Types.ObjectId;
	processedByUserId: string;
}): Promise<ApproveInquiryToActiveResult> {
	const inquiry = await AcademyInquiry.findById(options.inquiryId);
	if (!inquiry) {
		throw new PlatformInquiryApproveError('문의를 찾을 수 없습니다.', 'inquiry_not_found');
	}
	if (!inquiry.academyId || inquiry.status !== 'trial') {
		throw new PlatformInquiryApproveError(
			'체험 승인된 문의만 정식 승인할 수 있습니다.',
			'inquiry_invalid_status'
		);
	}

	const priorAcademy = await Academy.findById(inquiry.academyId).lean();
	if (!priorAcademy) {
		throw new PlatformInquiryApproveError('연결된 학원을 찾을 수 없습니다.', 'academy_not_found');
	}

	const now = new Date();
	const priorStatus = priorAcademy.status;
	const priorTrialEndsAt = priorAcademy.trialEndsAt;

	const academy = (await Academy.findByIdAndUpdate(
		inquiry.academyId,
		{ $set: { status: 'active' }, $unset: { trialEndsAt: '' } },
		{ new: true }
	)) as (AcademyDoc & { _id: Types.ObjectId }) | null;

	if (!academy) {
		throw new PlatformInquiryApproveError('연결된 학원을 찾을 수 없습니다.', 'academy_not_found');
	}

	try {
		inquiry.status = 'approved';
		inquiry.processedByUserId = options.processedByUserId;
		inquiry.processedAt = now;
		await inquiry.save();
	} catch (err) {
		await Academy.updateOne(
			{ _id: inquiry.academyId },
			{
				$set: {
					status: priorStatus,
					...(priorTrialEndsAt !== undefined ? { trialEndsAt: priorTrialEndsAt } : {})
				},
				...(priorTrialEndsAt === undefined ? { $unset: { trialEndsAt: '' } } : {})
			}
		).catch(() => undefined);
		throw err;
	}

	return {
		academy,
		inquiry: inquiry as AcademyInquiryDoc & { _id: Types.ObjectId }
	};
}
