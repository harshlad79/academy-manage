import mongoose, { Schema, model, type Types } from 'mongoose';

export type EnrollmentDoc = {
	academyId: Types.ObjectId;
	studentId: Types.ObjectId;
	courseId: Types.ObjectId;
};

const EnrollmentSchema = new Schema<EnrollmentDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
		courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true }
	},
	{ timestamps: true }
);

EnrollmentSchema.index({ academyId: 1, studentId: 1, courseId: 1 }, { unique: true });

export const Enrollment =
	mongoose.models.Enrollment ?? model<EnrollmentDoc>('Enrollment', EnrollmentSchema);
