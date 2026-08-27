"use client";

import { useEffect, useState } from "react";

type RememberedUser = { name: string; email: string } | null;

const PUSH_EMAIL_KEY = "yoga_push_email";
const DISMISSED_KEY = "yoga_push_banner_dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Prompts returning students (identified by the same "remembered" localStorage
// email used by SignupModal) to enable push on this device, without requiring
// them to find their way to /preferences first.
export default function StudentPushBanner() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const remembered: RememberedUser = JSON.parse(localStorage.getItem("yoga_user") || "null");
    if (!remembered?.email) return;

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      const alreadyEnabled = !!sub && localStorage.getItem(PUSH_EMAIL_KEY) === remembered.email.toLowerCase();
      if (!alreadyEnabled) {
        setEmail(remembered.email);
        setVisible(true);
      }
    });
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  async function enable() {
    if (!email) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismiss();
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
      localStorage.setItem(PUSH_EMAIL_KEY, email.toLowerCase());
      setVisible(false);
    } catch {
      dismiss();
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      style={{
        background: "white", borderRadius: 12, padding: "14px 16px", marginBottom: 12,
        border: "1.5px solid #e8dfd4", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 13, color: "#666" }}>
        🔔 Get a push notification on this device for class updates, cancellations, and studio messages.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" disabled={loading} onClick={enable}>
          {loading ? "…" : "Enable"}
        </button>
        <button className="btn" onClick={dismiss} style={{ opacity: 0.6 }}>
          Not now
        </button>
      </div>
    </div>
  );
}
