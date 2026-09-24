"use client";

import { useEffect, useRef } from "react";

// iOS suspends backgrounded PWAs, which silently drops the Supabase Realtime
// socket — so a push can arrive while the open app still shows stale data.
// Refetch whenever the app comes back to the foreground, reconnects, or the
// service worker tells us a push just landed.
export function useRefreshOnWake(refresh: () => void) {
  const ref = useRef(refresh);
  useEffect(() => { ref.current = refresh; });

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") ref.current(); };
    const onMessage = (e: MessageEvent) => { if (e.data?.type === "refresh") ref.current(); };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("online", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("online", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);
}
