"use client";

import { useEffect } from "react";

// The app-icon badge means "things happened since you last looked", not
// "undismissed notifications" — so opening (or returning to) the app clears it.
// Mounted unconditionally so it works even when the PWA has no Clerk session
// and the admin inbox itself never renders.
export default function BadgeClearer() {
  useEffect(() => {
    if (!("clearAppBadge" in navigator)) return;

    const clear = () => {
      if (document.visibilityState === "visible") navigator.clearAppBadge().catch(() => {});
    };

    clear();
    document.addEventListener("visibilitychange", clear);
    return () => document.removeEventListener("visibilitychange", clear);
  }, []);

  return null;
}
