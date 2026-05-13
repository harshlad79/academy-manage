import mongoose, { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * PRD §6.2 — 학부모–자녀 연결.
 *
 * `parentUserId` 는 Better Auth `user.id` 문자열이며 `AcademyMembership` 의 동일 학원에서
 * `role: 'parent'` 인 사용자여야 한다(검증은 서버 액션이 수행).
 */
export type ParentStudentLinkDoc = {
	academyId: Types.ObjectId;
	parentUserId: string;
	studentId: Types.ObjectId;
};

const ParentStudentLinkSchema = new Schema<ParentStudentLinkDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		parentUserId: { type: String, required: true, index: true },
		studentId: { type: Schema.Types.ObjectId, required: true, ref: 'Student', index: true }
	},
	{ timestamps: true }
);

ParentStudentLinkSchema.index({ academyId: 1, parentUserId: 1, studentId: 1 }, { unique: true });

export const ParentStudentLink =
	mongoose.models.ParentStudentLink ??
	model<ParentStudentLinkDoc>('ParentStudentLink', ParentStudentLinkSchema);
