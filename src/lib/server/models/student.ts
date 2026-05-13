import mongoose, { Schema, model, type Types } from 'mongoose';

export type StudentDoc = {
	academyId: Types.ObjectId;
	name: string;
	grade?: string;
};

const StudentSchema = new Schema<StudentDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		name: { type: String, required: true },
		grade: { type: String }
	},
	{ timestamps: true }
);

export const Student = mongoose.models.Student ?? model<StudentDoc>('Student', StudentSchema);
