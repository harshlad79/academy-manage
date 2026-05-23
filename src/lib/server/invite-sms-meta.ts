import type { Types } from 'mongoose';

import { AcademyInvite } from '$lib/server/models/academy-invite';
import type { InviteSmsResult } from '$lib/server/invite-sms';

/** `sendAcademyInviteSms` 결과를 `AcademyInvite` SMS 메타 필드에 반영. */
export async function applyInviteSmsMeta(
	inviteId: Types.ObjectId,
	result: InviteSmsResult
): Promise<void> {
	if (result.status === 'sent') {
		await AcademyInvite.updateOne(
			{ _id: inviteId },
			{ $set: { lastSmsSentAt: new Date() }, $unset: { lastSmsError: 1 } }
		);
		return;
	}
	if (result.status === 'failed') {
		await AcademyInvite.updateOne({ _id: inviteId }, { $set: { lastSmsError: result.error } });
	}
}
