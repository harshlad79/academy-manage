// 학부모 포털 푸시 알림 서비스 워커 — /p/settings 구독 등록 시 install 됨.
self.addEventListener('push', (event) => {
	let data = { title: '학원 알림', body: '', url: '/p' };
	try {
		if (event.data) {
			data = { ...data, ...event.data.json() };
		}
	} catch {
		if (event.data) data.body = event.data.text();
	}
	event.waitUntil(
		self.registration.showNotification(data.title, {
			body: data.body,
			data: { url: data.url }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data?.url || '/p';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url.includes(url) && 'focus' in client) return client.focus();
			}
			return self.clients.openWindow(url);
		})
	);
});
