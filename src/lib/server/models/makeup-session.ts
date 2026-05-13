import mongoose, { Schema, model, type Types } from 'mongoose';

export type MakeupSessionDoc = {
	academyId: Types.ObjectId;
	enrollmentId: Types.ObjectId;
	/** Asia/Seoul 기준 YYYY-MM-DD */
	sessionDate: string;
	/** HH:mm, 선택 */
	sessionTime?: string;
	description: string;
};

const MakeupSessionSchema = new Schema<MakeupSessionDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
		sessionDate: { type: String, required: true, index: true },
		sessionTime: { type: String },
		description: { type: String, required: true }
	},
	{ timestamps: true }
);

MakeupSessionSchema.index({ academyId: 1, sessionDate: -1, createdAt: -1 });

export const MakeupSession =
	mongoose.models.MakeupSession ?? model<MakeupSessionDoc>('MakeupSession', MakeupSessionSchema);
