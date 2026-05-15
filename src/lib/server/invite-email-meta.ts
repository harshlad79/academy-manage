import type { Types } from 'mongoose';

import type { InviteMailResult } from '$lib/server/invite-mail';
import { AcademyInvite } from '$lib/server/models/academy-invite';

/** `sendAcademyInviteEmail` 결과를 `AcademyInvite` 메타 필드에 반영. */
export async function applyInviteEmailMeta(
	inviteId: Types.ObjectId,
	result: InviteMailResult
): Promise<void> {
	if (result.status === 'sent') {
		await AcademyInvite.updateOne(
			{ _id: inviteId },
			{ $set: { lastEmailSentAt: new Date() }, $unset: { lastEmailError: 1 } }
		);
		return;
	}
	if (result.status === 'failed') {
		await AcademyInvite.updateOne({ _id: inviteId }, { $set: { lastEmailError: result.error } });
	}
}
