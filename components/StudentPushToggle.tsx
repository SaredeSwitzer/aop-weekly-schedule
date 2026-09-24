"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

type Props = { email: string; showToast: (msg: string, ok?: boolean) => void };
type Status = "checking" | "unsupported-ios" | "unsupported" | "denied" | "ready";

// Push is per-device (students aren't authenticated), so "on" means this
// device's subscription is registered on the server to this email.
const STORAGE_KEY = "yoga_push_email";

export default function StudentPushToggle({ email, showToast }: Props) {
  const [status, setStatus] = useState<Status>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setStatus(isIos() ? "unsupported-ios" : "unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      let registeredEmail: string | null = null;
      if (sub) {
        const res = await fetch(`/api/push/student-subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`).catch(() => null);
        registeredEmail = res?.ok ? (await res.json()).email : null;
      }
      if (cancelled) return;
      setSubscribed(registeredEmail === email.toLowerCase());
      setStatus(Notification.permission === "denied" ? "denied" : "ready");
    })();
    return () => { cancelled = true; };
  }, [email]);

  async function enable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
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
      showToast("Push notifications turned on for this device.");
    } catch {
      showToast("Couldn't turn on push notifications.", false);
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
      showToast("Push notifications turned off for this device.");
    } catch {
      showToast("Couldn't turn off push notifications.", false);
    } finally {
      setLoading(false);
    }
  }

  const usable = status === "ready";
  const hint =
    status === "unsupported-ios" ? "On iPhone, push only works in the app: tap Share → Add to Home Screen, then open AOP Shala from your Home Screen and come back here." :
    status === "unsupported" ? "This browser doesn't support push notifications." :
    status === "denied" ? "Notifications are blocked for this app. Turn them on in your phone's Settings → Notifications → AOP Shala." :
    "A notification on this device when your class is moved or cancelled, plus studio messages.";

  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", cursor: usable ? "pointer" : "default" }}>
      <input
        type="checkbox"
        style={{ marginTop: 3, width: 18, height: 18 }}
        checked={subscribed}
        disabled={!usable || loading}
        onChange={() => (subscribed ? disable() : enable())}
      />
      <span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Push notifications on this device{loading ? " …" : ""}
        </span>
        <span style={{ display: "block", fontSize: 12, color: "#888", marginTop: 2 }}>
          {status === "checking" ? "Checking…" : hint}
        </span>
      </span>
    </label>
  );
}
