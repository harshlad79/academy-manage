import mongoose, { Schema, model, type Types } from 'mongoose';

export const attendanceStatuses = ['present', 'late', 'absent'] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export type AttendanceDoc = {
	academyId: Types.ObjectId;
	enrollmentId: Types.ObjectId;
	/** Asia/Seoul 기준 YYYY-MM-DD */
	sessionDate: string;
	status: AttendanceStatus;
	reason?: string;
};

const AttendanceSchema = new Schema<AttendanceDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
		sessionDate: { type: String, required: true, index: true },
		status: {
			type: String,
			required: true,
			enum: attendanceStatuses
		},
		reason: { type: String }
	},
	{ timestamps: true }
);

AttendanceSchema.index({ academyId: 1, enrollmentId: 1, sessionDate: 1 }, { unique: true });

export const Attendance =
	mongoose.models.Attendance ?? model<AttendanceDoc>('Attendance', AttendanceSchema);
