import mongoose, { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

import { normalizeInvitePhone } from './academy-invite';

export const LEAD_STATUSES = ['new', 'contacted', 'waitlisted', 'converted', 'closed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ['web', 'staff'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export type LeadDoc = {
	academyId: Types.ObjectId;
	studentName: string;
	guardianName: string;
	/** `normalizeInvitePhone` 적용값 */
	phone: string;
	memo?: string;
	source: LeadSource;
	status: LeadStatus;
	studentId?: Types.ObjectId;
	convertedAt?: Date;
	enrolledAt?: Date;
	assignedToUserId?: string;
	createdByUserId?: string;
	closeReason?: string;
	createdAt: Date;
	updatedAt: Date;
};

function setNormalizedPhone(raw: string): string {
	return normalizeInvitePhone(String(raw)) ?? String(raw);
}

const LeadSchema = new Schema<LeadDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, ref: 'Academy' },
		studentName: { type: String, required: true, trim: true },
		guardianName: { type: String, required: true, trim: true },
		phone: {
			type: String,
			required: true,
			set: setNormalizedPhone,
			validate: {
				validator: (v: string) => normalizeInvitePhone(v) !== null,
				message: '유효한 휴대번호(010)를 입력하세요.'
			}
		},
		memo: { type: String, trim: true },
		source: {
			type: String,
			enum: [...LEAD_SOURCES],
			required: true
		},
		status: {
			type: String,
			enum: [...LEAD_STATUSES],
			required: true,
			default: 'new'
		},
		studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
		convertedAt: { type: Date },
		enrolledAt: { type: Date },
		assignedToUserId: { type: String },
		createdByUserId: { type: String },
		closeReason: { type: String, trim: true }
	},
	{ timestamps: true }
);

LeadSchema.index({ academyId: 1, status: 1, createdAt: -1 });
LeadSchema.index({ academyId: 1, phone: 1 });

export const Lead = mongoose.models.Lead ?? model<LeadDoc>('Lead', LeadSchema);
