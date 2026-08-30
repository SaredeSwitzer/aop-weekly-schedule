"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Notification = { id: string; type: string; title: string; body: string; created_at: string };

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin-notifications")
      .then((r) => r.json())
      // A 401 (no Clerk session in the installed PWA) returns an error object,
      // not an array — guard so the list doesn't blow up on .map().
      .then((data: unknown) => setNotifications(Array.isArray(data) ? (data as Notification[]) : []))
      .catch(() => {})
      .finally(() => setLoaded(true));

    const ch = supabase
      .channel("admin-notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "admin_notifications" }, (payload) => {
        setNotifications((prev) => prev.filter((n) => n.id !== (payload.old as Notification).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  async function dismiss(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/admin-notifications?id=${id}`, { method: "DELETE" }).catch(() => {});
  }

  if (!loaded || notifications.length === 0) return null;

  return (
    <div style={{ background: "white", borderRadius: 12, padding: "18px 20px", marginBottom: 18, border: "1.5px solid #e8dfd4" }}>
      <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
        Notifications ({notifications.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
              background: "#faf7f2", borderRadius: 8, padding: "10px 12px",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#3d2e1e" }}>{n.title}</div>
              <div style={{ fontSize: 12.5, color: "#666", marginTop: 2 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{timeAgo(n.created_at)}</div>
            </div>
            <button
              onClick={() => dismiss(n.id)}
              aria-label="Dismiss"
              style={{
                background: "none", border: "none", cursor: "pointer", color: "#999",
                fontSize: 16, lineHeight: 1, padding: 4,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
