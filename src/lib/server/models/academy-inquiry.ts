import mongoose, { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

import { normalizeInviteEmail, normalizeInvitePhone } from './academy-invite';

export type AcademyInquiryStatus = 'new' | 'contacted' | 'trial' | 'approved' | 'rejected';

export type AcademyInquiryDoc = {
	academyName: string;
	contactName: string;
	/** `normalizeInvitePhone` 적용값 */
	phone: string;
	/** `normalizeInviteEmail` 적용값 */
	email: string;
	region: string;
	memo?: string;
	status: AcademyInquiryStatus;
	/** trial 승인 시 기록(기본 7) */
	trialDays?: number;
	academyId?: Types.ObjectId;
	processedByUserId?: string;
	processedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
};

const INQUIRY_STATUS_VALUES = ['new', 'contacted', 'trial', 'approved', 'rejected'] as const;

function setNormalizedPhone(raw: string): string {
	return normalizeInvitePhone(String(raw)) ?? String(raw);
}

function setNormalizedEmail(raw: string): string {
	return normalizeInviteEmail(String(raw)) ?? String(raw).trim().toLowerCase();
}

const AcademyInquirySchema = new Schema<AcademyInquiryDoc>(
	{
		academyName: { type: String, required: true, trim: true },
		contactName: { type: String, required: true, trim: true },
		phone: {
			type: String,
			required: true,
			set: setNormalizedPhone,
			validate: {
				validator: (v: string) => normalizeInvitePhone(v) !== null,
				message: '유효한 휴대번호(010)를 입력하세요.'
			}
		},
		email: {
			type: String,
			required: true,
			set: setNormalizedEmail,
			validate: {
				validator: (v: string) => normalizeInviteEmail(v) !== null,
				message: '유효한 이메일을 입력하세요.'
			}
		},
		region: { type: String, required: true, trim: true },
		memo: { type: String, trim: true },
		status: {
			type: String,
			enum: [...INQUIRY_STATUS_VALUES],
			required: true,
			default: 'new'
		},
		trialDays: { type: Number, min: 1 },
		academyId: { type: Schema.Types.ObjectId, ref: 'Academy' },
		processedByUserId: { type: String },
		processedAt: { type: Date }
	},
	{ timestamps: true }
);

AcademyInquirySchema.index({ status: 1 });
AcademyInquirySchema.index({ createdAt: -1 });
AcademyInquirySchema.index({ email: 1 });

export const AcademyInquiry =
	mongoose.models.AcademyInquiry ??
	model<AcademyInquiryDoc>('AcademyInquiry', AcademyInquirySchema);

export type AcademyInquiryCreateInput = {
	academyName: string;
	contactName: string;
	phone: string;
	email: string;
	region: string;
	memo?: string;
};

/** 공개 폼·서비스 레이어용 — 정규화·필수 검증 */
export function validateAcademyInquiryCreateInput(
	input: AcademyInquiryCreateInput
):
	| { ok: true; fields: Pick<AcademyInquiryDoc, 'academyName' | 'contactName' | 'phone' | 'email' | 'region' | 'memo'> }
	| { ok: false; error: string } {
	const academyName = input.academyName.trim();
	const contactName = input.contactName.trim();
	const region = input.region.trim();
	if (!academyName) return { ok: false, error: '학원명을 입력하세요.' };
	if (!contactName) return { ok: false, error: '담당자명을 입력하세요.' };
	if (!region) return { ok: false, error: '지역/주소를 입력하세요.' };

	const phone = normalizeInvitePhone(input.phone);
	if (!phone) return { ok: false, error: '유효한 휴대번호(010)를 입력하세요.' };

	const email = normalizeInviteEmail(input.email);
	if (!email) return { ok: false, error: '유효한 이메일을 입력하세요.' };

	const memo = input.memo?.trim();
	return {
		ok: true,
		fields: {
			academyName,
			contactName,
			phone,
			email,
			region,
			...(memo ? { memo } : {})
		}
	};
}
