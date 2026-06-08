"use client";

import { useEffect, useRef, useState } from "react";
import { DAYS, fmtTimeRange, fmtDate, getSlotDate } from "@/lib/dates";
import type { Class, Signup } from "@/lib/types";

type Tab = "signup" | "cancel";

type RememberedUser = { name: string; email: string };

function getRememberedUser(): RememberedUser | null {
  try {
    return JSON.parse(localStorage.getItem("yoga_user") || "null");
  } catch {
    return null;
  }
}

type Props = {
  cls: Class;
  signups: Signup[];
  weekKey: string;
  onClose: () => void;
  onSignupSuccess: () => void;
  onCancelSuccess: () => void;
};

export default function SignupModal({ cls, signups, weekKey, onClose, onSignupSuccess, onCancelSuccess }: Props) {
  const taken = signups.length;
  const full  = taken >= cls.capacity;

  const [tab, setTab]         = useState<Tab>(full ? "cancel" : "signup");
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [cancelEmail, setCancelEmail] = useState("");
  const [rememberMe, setRememberMe]   = useState(false);
  const [remembered, setRemembered]   = useState<RememberedUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState("");

  const nameRef   = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLInputElement>(null);

  const slotDate = getSlotDate(cls.day, weekKey);
  const dateStr  = fmtDate(slotDate);
  const dayStr   = DAYS[cls.day];
  const timeStr  = fmtTimeRange(cls.time, cls.end_time);

  // Load remembered user on mount
  useEffect(() => {
    const r = getRememberedUser();
    if (r) {
      setRemembered(r);
      setCancelEmail(r.email);
    }
    setTimeout(() => (tab === "signup" ? nameRef.current?.focus() : cancelRef.current?.focus()), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus correct field on tab switch
  useEffect(() => {
    setTimeout(() => (tab === "signup" ? nameRef.current?.focus() : cancelRef.current?.focus()), 50);
  }, [tab]);

  function forgetMe() {
    localStorage.removeItem("yoga_user");
    setRemembered(null);
    setCancelEmail("");
  }

  async function handleSignup() {
    const n = remembered?.name ?? name.trim();
    const e = remembered?.email ?? email.trim();
    if (!n || !e) { setToast("Please fill in your name and email."); return; }

    setLoading(true);
    const res = await fetch("/api/signups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ week_key: weekKey, class_id: cls.id, name: n, email: e }),
    });
    setLoading(false);

    if (res.status === 409) {
      const { error } = await res.json();
      setToast(error === "already_signed_up" ? "You're already signed up for this class!" : "This class is full.");
      return;
    }
    if (!res.ok) { setToast("Something went wrong. Please try again."); return; }

    // Save to localStorage if checkbox or already remembered
    if (remembered || rememberMe) {
      localStorage.setItem("yoga_user", JSON.stringify({ name: n, email: e }));
    }
    onSignupSuccess();
  }

  async function handleCancel() {
    const e = remembered?.email ?? cancelEmail.trim();
    if (!e) { setToast("Please enter your email."); return; }

    setLoading(true);
    const res = await fetch(
      `/api/signups?week_key=${encodeURIComponent(weekKey)}&class_id=${encodeURIComponent(cls.id)}&email=${encodeURIComponent(e)}`,
      { method: "DELETE" },
    );
    setLoading(false);

    if (res.status === 404) { setToast("We couldn't find that email in this class."); return; }
    if (!res.ok) { setToast("Something went wrong. Please try again."); return; }

    onCancelSuccess();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <h3>{tab === "signup" ? "Reserve Your Spot" : "Cancel My Signup"}</h3>
        <div className="modal-location" style={{ fontSize: 13, color: "#9a7d5e", marginBottom: 2 }}>
          {cls.class_name} · {timeStr} · {dayStr}
        </div>
        {cls.location && (
          <div className="modal-location">📍 {cls.location}</div>
        )}
        <div style={{ fontSize: 12, color: "#bbb", marginBottom: 10 }}>
          {cls.capacity - taken} of {cls.capacity} spots remaining
        </div>

        <div style={{ background: "#f5ece0", borderRadius: 9, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#c4956a", marginBottom: 5 }}>
            👥 Signed up
          </div>
          {taken === 0 ? (
            <div style={{ fontSize: 13, color: "#bbb" }}>No one yet — be the first!</div>
          ) : (
            <div style={{ fontSize: 13, color: "#5a3e28", lineHeight: 1.7 }}>
              {signups.map((s) => <div key={s.id}>{s.name}</div>)}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {!full && (
            <button className={`tab-btn${tab === "signup" ? " active" : ""}`} onClick={() => setTab("signup")}>
              Sign Up
            </button>
          )}
          <button className={`tab-btn${tab === "cancel" ? " active" : ""}`} onClick={() => setTab("cancel")}>
            Cancel My Signup
          </button>
        </div>

        {/* Sign up form */}
        {tab === "signup" && (
          <div>
            {remembered ? (
              <div style={{ background: "#f5ece0", borderRadius: 9, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#5a3e28" }}>👋 Signing up as <strong>{remembered.name}</strong></span>
                <button onClick={forgetMe} style={{ background: "none", border: "none", fontSize: 11, color: "#c4956a", cursor: "pointer", textDecoration: "underline" }}>Not you?</button>
              </div>
            ) : (
              <>
                <div className="field-group">
                  <label className="field-label">Your Name</label>
                  <input ref={nameRef} className="input-field" type="text" placeholder="Full name"
                    value={name} onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSignup()} />
                </div>
                <div className="field-group">
                  <label className="field-label">Email Address</label>
                  <input className="input-field" type="email" placeholder="your@email.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSignup()} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9a7d5e", cursor: "pointer", marginBottom: 4 }}>
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: "#c4956a", width: 15, height: 15 }} />
                  Remember me on this device
                </label>
              </>
            )}
            {toast && <div style={{ color: "#c44", fontSize: 13, marginBottom: 8 }}>{toast}</div>}
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleSignup} disabled={loading}>
                {loading ? "Saving…" : "Sign Me Up →"}
              </button>
              <button className="btn-cancel" onClick={onClose}>Close</button>
            </div>
          </div>
        )}

        {/* Cancel form */}
        {tab === "cancel" && (
          <div>
            {remembered ? (
              <div style={{ background: "#f5ece0", borderRadius: 9, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#5a3e28" }}>Cancelling as <strong>{remembered.name}</strong></span>
                <button onClick={forgetMe} style={{ background: "none", border: "none", fontSize: 11, color: "#c4956a", cursor: "pointer", textDecoration: "underline" }}>Not you?</button>
              </div>
            ) : (
              <div className="field-group">
                <div style={{ fontSize: 13, color: "#888", marginBottom: 14 }}>Enter your email address to remove yourself from this class.</div>
                <label className="field-label">Your Email</label>
                <input ref={cancelRef} className="input-field" type="email" placeholder="your@email.com"
                  value={cancelEmail} onChange={(e) => setCancelEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCancel()} />
              </div>
            )}
            {toast && <div style={{ color: "#c44", fontSize: 13, marginBottom: 8 }}>{toast}</div>}
            <div className="modal-actions">
              <button className="btn-primary" style={{ background: "#e07070" }} onClick={handleCancel} disabled={loading}>
                {loading ? "Removing…" : "Remove My Signup"}
              </button>
              <button className="btn-cancel" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
