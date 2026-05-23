import { randomBytes } from 'node:crypto';

import mongoose, { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

import type { AcademyRole } from '$lib/server/rbac';

/** 플랫폼에서 초대 가능한 역할(super_admin 제외) */
export type AcademyInviteRole = Exclude<AcademyRole, 'super_admin'>;

export type AcademyInviteDoc = {
	academyId: Types.ObjectId;
	/** 소문자·트림된 이메일 */
	email: string;
	role: AcademyInviteRole;
	/** 단건 초대 식별(수락 URL) */
	token: string;
	expiresAt: Date;
	/** 초대를 만든 플랫폼 사용자 Better Auth id (선택) */
	createdByUserId?: string;
	/** teacher 초대 시 미리 연결할 강사 프로필 */
	linkedTeacherId?: Types.ObjectId;
	/** 마지막 초대 메일 발송 성공 시각 */
	lastEmailSentAt?: Date;
	/** 마지막 초대 메일 발송 실패 메시지(짧게 truncate) */
	lastEmailError?: string;
};

const INVITE_ROLE_VALUES = ['academy_admin', 'office', 'teacher', 'parent'] as const;

const AcademyInviteSchema = new Schema<AcademyInviteDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		email: { type: String, required: true },
		role: { type: String, required: true, enum: [...INVITE_ROLE_VALUES] },
		token: { type: String, required: true, unique: true, index: true },
		expiresAt: { type: Date, required: true, index: true },
		createdByUserId: { type: String },
		linkedTeacherId: { type: Schema.Types.ObjectId, ref: 'Teacher' },
		lastEmailSentAt: { type: Date },
		lastEmailError: { type: String }
	},
	{ timestamps: true }
);

AcademyInviteSchema.index({ academyId: 1, email: 1 }, { unique: true });

export const AcademyInvite =
	mongoose.models.AcademyInvite ?? model<AcademyInviteDoc>('AcademyInvite', AcademyInviteSchema);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInviteEmail(raw: string): string | null {
	const s = raw.trim().toLowerCase();
	if (s.length > 254 || !EMAIL_RE.test(s)) return null;
	return s;
}

/** 한국 휴대(010) — 하이픈·공백 제거, `010` + 8자리(총 11자). */
export function normalizeInvitePhone(raw: string): string | null {
	let s = raw.trim().replace(/[\s-]/g, '');
	if (s.startsWith('+82')) {
		s = `0${s.slice(3)}`;
	}
	if (!/^010\d{8}$/.test(s)) return null;
	return s;
}

export function generateInviteToken(): string {
	return randomBytes(32).toString('hex');
}

export function defaultInviteExpiresAt(): Date {
	const d = new Date();
	d.setDate(d.getDate() + 14);
	return d;
}
