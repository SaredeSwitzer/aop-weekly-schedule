"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RememberedUser = { name: string; email: string } | null;

const PUSH_EMAIL_KEY = "yoga_push_email";
const DISMISSED_KEY = "yoga_push_banner_dismissed";

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

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Offers push to every visitor on the schedule page until they either enable
// it or dismiss the banner — after that it never reappears on this device,
// and they can still opt in from /preferences. iOS only allows push inside the
// installed Home Screen app, so a plain Safari tab gets install steps instead.
export default function StudentPushBanner() {
  const [mode, setMode] = useState<"hidden" | "enable" | "install">("hidden");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!pushSupported) {
      if (isIos() && !isStandalone()) queueMicrotask(() => setMode("install"));
      return;
    }
    if (Notification.permission === "denied") return;

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub && localStorage.getItem(PUSH_EMAIL_KEY)) return;
      const remembered: RememberedUser = JSON.parse(localStorage.getItem("yoga_user") || "null");
      if (remembered?.email) setEmail(remembered.email);
      setMode("enable");
    });
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setMode("hidden");
  }

  async function enable() {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError("Enter the email you sign up for classes with.");
      return;
    }
    setError("");
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
        body: JSON.stringify({ email: e, endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Failed to save subscription");
      localStorage.setItem(PUSH_EMAIL_KEY, e);
      localStorage.setItem(DISMISSED_KEY, "1");
      setMode("hidden");
    } catch {
      setError("Couldn't turn on notifications. You can try again from My notifications.");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "hidden") return null;

  return (
    <div
      style={{
        background: "white", borderRadius: 12, padding: "14px 16px", marginBottom: 12,
        border: "1.5px solid #e8dfd4", display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ fontSize: 14, color: "#444", fontWeight: 600 }}>
        🔔 Get notified when your class changes
      </div>

      {mode === "install" ? (
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
          To get alerts on your iPhone about class changes, cancellations, and studio messages, tap the{" "}
          <strong>Share</strong> button below, choose <strong>Add to Home Screen</strong>, then open AOP Shala
          from your Home Screen and tap <strong>Enable</strong>.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#666" }}>
            Get a notification on this device when a class you signed up for is moved or cancelled, plus studio messages.
          </div>
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
          />
        </>
      )}

      {error && <div style={{ fontSize: 12, color: "#b00" }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {mode === "enable" && (
          <button className="btn" disabled={loading} onClick={enable}>
            {loading ? "…" : "Enable"}
          </button>
        )}
        <button className="btn" onClick={dismiss} style={{ opacity: 0.6 }}>
          {mode === "install" ? "Got it" : "Not now"}
        </button>
        <span style={{ fontSize: 12, color: "#999" }}>
          You can change this anytime in <Link href="/preferences">My notifications</Link>.
        </span>
      </div>
    </div>
  );
}
