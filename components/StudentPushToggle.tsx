"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Props = { email: string; showToast: (msg: string, ok?: boolean) => void };

// Push is per-device, not per-account (students aren't authenticated), so we
// track which email this device's subscription belongs to in localStorage —
// otherwise switching the email on /preferences would show a stale "enabled"
// state carried over from a previous lookup on the same device.
const STORAGE_KEY = "yoga_push_email";

export default function StudentPushToggle({ email, showToast }: Props) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub && localStorage.getItem(STORAGE_KEY) === email.toLowerCase());
    });
  }, [email]);

  async function enable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showToast("Notification permission denied.", false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });
      }
      const json = sub.toJSON();
      const res = await fetch("/api/push/student-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Failed to save subscription");
      localStorage.setItem(STORAGE_KEY, email.toLowerCase());
      setSubscribed(true);
      showToast("Push notifications enabled on this device.");
    } catch {
      showToast("Couldn't enable push notifications.", false);
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/student-subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      localStorage.removeItem(STORAGE_KEY);
      setSubscribed(false);
      showToast("Push notifications disabled on this device.");
    } catch {
      showToast("Couldn't disable push notifications.", false);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="field-group">
      <label className="field-label">Push Notifications (this device)</label>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
        {subscribed
          ? "You'll get a push notification on this device for schedule updates, class changes, and messages from the studio."
          : "Get a push notification on this device for schedule updates, class changes, and messages from the studio."}
      </div>
      <button className="btn" type="button" disabled={loading} onClick={subscribed ? disable : enable}>
        {loading ? "…" : subscribed ? "Disable on this device" : "Enable on this device"}
      </button>
    </div>
  );
}
