import mongoose, { Schema, model, type Types } from 'mongoose';

export type TeacherDoc = {
	academyId: Types.ObjectId;
	name: string;
	subject?: string;
};

const TeacherSchema = new Schema<TeacherDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		name: { type: String, required: true },
		subject: { type: String }
	},
	{ timestamps: true }
);

export const Teacher = mongoose.models.Teacher ?? model<TeacherDoc>('Teacher', TeacherSchema);
