import mongoose, { Schema, model, type Types } from 'mongoose';
import { attendanceStatuses, type AttendanceStatus } from '$lib/server/models/attendance';

export type AttendanceAuditLogDoc = {
	academyId: Types.ObjectId;
	courseId: Types.ObjectId;
	enrollmentId: Types.ObjectId;
	sessionDate: string;
	actorUserId: string;
	previousStatus: AttendanceStatus;
	previousReason: string;
	newStatus: AttendanceStatus;
	newReason: string;
};

const AttendanceAuditLogSchema = new Schema<AttendanceAuditLogDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
		enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
		sessionDate: { type: String, required: true, index: true },
		actorUserId: { type: String, required: true, index: true },
		previousStatus: { type: String, required: true, enum: attendanceStatuses },
		previousReason: { type: String, default: '' },
		newStatus: { type: String, required: true, enum: attendanceStatuses },
		newReason: { type: String, default: '' }
	},
	{ timestamps: true }
);

AttendanceAuditLogSchema.index({ academyId: 1, courseId: 1, sessionDate: 1, createdAt: -1 });

export const AttendanceAuditLog =
	mongoose.models.AttendanceAuditLog ??
	model<AttendanceAuditLogDoc>('AttendanceAuditLog', AttendanceAuditLogSchema);
