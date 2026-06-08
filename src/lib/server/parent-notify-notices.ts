import { parentNotifyEmailNoticeMessage } from '$lib/server/parent-notify-email';
import { parentNotifyPushNoticeMessage } from '$lib/server/parent-notify-push';
import { parentNotifySmsNoticeMessage } from '$lib/server/parent-notify-sms';

export function parentNotifyNoticeMessage(notice: string | null): string | null {
	return (
		parentNotifySmsNoticeMessage(notice) ??
		parentNotifyEmailNoticeMessage(notice) ??
		parentNotifyPushNoticeMessage(notice) ??
		null
	);
}
