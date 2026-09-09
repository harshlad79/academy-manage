import mongoose, { Schema, model, type Types } from 'mongoose';

/** 학원 단 공지 — 스태프(관리자·행정) 발행, 학부모 포털 열람. */
export type AnnouncementDoc = {
	academyId: Types.ObjectId;
	title: string;
	body: string;
	createdByUserId: string;
	createdAt: Date;
	updatedAt: Date;
};

export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_BODY_MAX = 4000;

const AnnouncementSchema = new Schema<AnnouncementDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		title: { type: String, required: true, trim: true, maxlength: ANNOUNCEMENT_TITLE_MAX },
		body: { type: String, required: true, trim: true, maxlength: ANNOUNCEMENT_BODY_MAX },
		createdByUserId: { type: String, required: true, index: true }
	},
	{ timestamps: true }
);

AnnouncementSchema.index({ academyId: 1, createdAt: -1 });

export const Announcement =
	mongoose.models.Announcement ?? model<AnnouncementDoc>('Announcement', AnnouncementSchema);
