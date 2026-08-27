"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import StudentPushToggle from "@/components/StudentPushToggle";

type Prefs = { email: string; phone: string; email_opt_in: boolean; sms_opt_in: boolean };

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

function PreferencesForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"email" | "sms" | "both" | "none">("email");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  async function load(e: string) {
    if (!isValidEmail(e)) { setToast("Please enter a valid email address."); return; }
    setLoading(true);
    setToast("");
    const res = await fetch(`/api/preferences?email=${encodeURIComponent(e)}`);
    setLoading(false);
    if (!res.ok) { setToast("Something went wrong. Please try again."); return; }
    const data: Prefs = await res.json();
    setPrefs(data);
    setPhone(data.phone);
    setChannel(
      data.email_opt_in && data.sms_opt_in ? "both" :
      data.sms_opt_in ? "sms" :
      data.email_opt_in ? "email" : "none",
    );
  }

  useEffect(() => {
    if (params.get("email")) load(params.get("email")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!prefs) return;
    const wantsSms = channel === "sms" || channel === "both";
    if (wantsSms && !phone.trim()) { setToast("Please enter a phone number to receive texts."); return; }

    setSaving(true);
    const res = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: prefs.email,
        phone: phone.trim(),
        email_opt_in: channel === "email" || channel === "both",
        sms_opt_in: wantsSms,
      }),
    });
    setSaving(false);
    if (res.status === 400) {
      const { error } = await res.json();
      setToast(error === "invalid_phone" ? "That phone number doesn't look right." : "Please enter a phone number to receive texts.");
      return;
    }
    if (!res.ok) { setToast("Something went wrong. Please try again."); return; }
    setToast("✓ Preferences saved.");
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: "0 20px" }}>
      <h3 style={{ marginBottom: 4 }}>Notification Preferences</h3>
      <div style={{ fontSize: 13, color: "#9a7d5e", marginBottom: 20 }}>
        Choose how you&apos;d like to hear about signups, cancellations, and schedule updates.
      </div>

      {!prefs && (
        <div className="field-group">
          <label className="field-label">Your Email</label>
          <input
            className="input-field" type="email" placeholder="your@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(email.trim())}
          />
          {toast && <div style={{ color: "#c44", fontSize: 13, margin: "8px 0" }}>{toast}</div>}
          <button className="btn-primary" style={{ marginTop: 10 }} onClick={() => load(email.trim())} disabled={loading}>
            {loading ? "Looking up…" : "Continue →"}
          </button>
        </div>
      )}

      {prefs && (
        <div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 14 }}>Editing preferences for <strong>{prefs.email}</strong></div>

          <div className="field-group">
            <label className="field-label">Phone Number (for text messages)</label>
            <input
              className="input-field" type="tel" placeholder="(555) 555-5555"
              value={phone} onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label">How should we notify you?</label>
            {([
              { v: "email", label: "Email only" },
              { v: "sms", label: "Text only" },
              { v: "both", label: "Email and text" },
              { v: "none", label: "Nothing" },
            ] as const).map((opt) => (
              <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, padding: "6px 0", cursor: "pointer" }}>
                <input type="radio" name="channel" checked={channel === opt.v} onChange={() => setChannel(opt.v)} />
                {opt.label}
              </label>
            ))}
          </div>

          {toast && <div style={{ color: toast.startsWith("✓") ? "#2a7a3d" : "#c44", fontSize: 13, margin: "8px 0" }}>{toast}</div>}

          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Preferences"}
          </button>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #eee" }}>
            <StudentPushToggle
              email={prefs.email}
              showToast={(msg, ok = true) => setToast(ok ? `✓ ${msg}` : msg)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreferencesPage() {
  return (
    <Suspense fallback={null}>
      <PreferencesForm />
    </Suspense>
  );
}
