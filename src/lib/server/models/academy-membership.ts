import mongoose, { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { ACADEMY_ROLES, type AcademyRole } from '$lib/server/rbac';

export type AcademyMembershipDoc = {
	userId: string;
	academyId: Types.ObjectId;
	role: AcademyRole;
	linkedTeacherId?: Types.ObjectId;
};

const AcademyMembershipSchema = new Schema<AcademyMembershipDoc>(
	{
		userId: { type: String, required: true, index: true },
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		role: { type: String, enum: [...ACADEMY_ROLES], required: true },
		linkedTeacherId: { type: Schema.Types.ObjectId, ref: 'Teacher' }
	},
	{ timestamps: true }
);

AcademyMembershipSchema.index({ userId: 1, academyId: 1 }, { unique: true });

export const AcademyMembership =
	mongoose.models.AcademyMembership ??
	model<AcademyMembershipDoc>('AcademyMembership', AcademyMembershipSchema);
