/// <reference lib="webworker" />
// Custom service worker logic, merged into the generated PWA service worker
// by @ducanh2912/next-pwa (looks for worker/index.ts by default).

declare const self: ServiceWorkerGlobalScope;

// Badge count persists in IndexedDB since the service worker itself is
// stateless and can be killed/restarted between pushes.
const BADGE_DB = "aop-badge";
const BADGE_STORE = "counter";
const BADGE_KEY = "unread";

function openBadgeDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BADGE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(BADGE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getBadgeCount(): Promise<number> {
  const db = await openBadgeDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BADGE_STORE, "readonly");
    const req = tx.objectStore(BADGE_STORE).get(BADGE_KEY);
    req.onsuccess = () => resolve((req.result as number | undefined) ?? 0);
    req.onerror = () => reject(req.error);
  });
}

async function setBadgeCount(count: number): Promise<void> {
  const db = await openBadgeDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BADGE_STORE, "readwrite");
    tx.objectStore(BADGE_STORE).put(count, BADGE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  if ("setAppBadge" in self.navigator) {
    if (count > 0) await self.navigator.setAppBadge(count);
    else await self.navigator.clearAppBadge();
  }
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json() as { title: string; body: string; url?: string };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: data.url ?? "/admin" },
      });
      await setBadgeCount((await getBadgeCount()) + 1);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_BADGE") {
    event.waitUntil(setBadgeCount(0));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/admin";

  event.waitUntil(
    (async () => {
      await setBadgeCount(0);
      const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clientsArr.find((c) => c.url.includes(url));
      if (existing) await (existing as WindowClient).focus();
      else await self.clients.openWindow(url);
    })(),
  );
});
