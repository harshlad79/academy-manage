import mongoose, { Schema, model, type Types } from 'mongoose';

export type CourseDoc = {
	academyId: Types.ObjectId;
	name: string;
	teacherId: Types.ObjectId;
};

const CourseSchema = new Schema<CourseDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		name: { type: String, required: true },
		teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true }
	},
	{ timestamps: true }
);

export const Course = mongoose.models.Course ?? model<CourseDoc>('Course', CourseSchema);
