/// <reference lib="webworker" />
// Custom service worker logic, merged into the generated PWA service worker
// by @ducanh2912/next-pwa (looks for worker/index.ts by default).

declare const self: ServiceWorkerGlobalScope;

type PushPayload = { title: string; body: string; url?: string; notificationId?: string; badgeCount?: number };

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json() as PushPayload;

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: data.url ?? "/admin", notificationId: data.notificationId },
      });
      // The server tells us the true unread count (shared admin inbox), so
      // just apply it directly — no local counting needed.
      if ("setAppBadge" in self.navigator && typeof data.badgeCount === "number") {
        if (data.badgeCount > 0) await self.navigator.setAppBadge(data.badgeCount);
        else await self.navigator.clearAppBadge();
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/admin";

  event.waitUntil(
    (async () => {
      // Tapping the notification means it's been seen — drop the icon badge
      // here rather than waiting for the app to load and decide, which never
      // happens when the PWA isn't carrying a signed-in Clerk session.
      if ("clearAppBadge" in self.navigator) await self.navigator.clearAppBadge();

      const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clientsArr.find((c) => c.url.includes(url));
      if (existing) return (existing as WindowClient).focus();
      await self.clients.openWindow(url);
    })(),
  );
});
