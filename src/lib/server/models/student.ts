import mongoose, { Schema, model, type Types } from 'mongoose';

export type StudentDoc = {
	academyId: Types.ObjectId;
	name: string;
	grade?: string;
	/** 보호자 이름(상담·연락용) */
	guardianName?: string;
	/** 보호자 휴대번호 — `normalizeInvitePhone` 규칙과 동일 */
	guardianPhone?: string;
};

const StudentSchema = new Schema<StudentDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		name: { type: String, required: true },
		grade: { type: String },
		guardianName: { type: String },
		guardianPhone: { type: String }
	},
	{ timestamps: true }
);

export const Student = mongoose.models.Student ?? model<StudentDoc>('Student', StudentSchema);
