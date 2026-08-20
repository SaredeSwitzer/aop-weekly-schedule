"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Props = { showToast: (msg: string, ok?: boolean) => void };

export default function PushNotificationToggle({ showToast }: Props) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  async function enable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showToast("Notification permission denied.", false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Failed to save subscription");
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
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
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
    <div style={{ background: "white", borderRadius: 12, padding: "18px 20px", marginBottom: 18, border: "1.5px solid #e8dfd4" }}>
      <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
        Push Notifications
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "#666" }}>
          {subscribed
            ? "You'll get a push notification on this device for every signup and cancellation."
            : "Get a push notification on this device whenever someone signs up or cancels."}
        </div>
        <button
          className="btn"
          disabled={loading}
          onClick={subscribed ? disable : enable}
        >
          {loading ? "…" : subscribed ? "Disable" : "Enable notifications"}
        </button>
      </div>
    </div>
  );
}
