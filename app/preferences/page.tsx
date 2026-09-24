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
  const [emailOptIn, setEmailOptIn] = useState(true);
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
    // Texting was removed — anyone who'd picked text-only is shown as emailed.
    setEmailOptIn(data.email_opt_in || data.sms_opt_in);
  }

  useEffect(() => {
    if (params.get("email")) load(params.get("email")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!prefs) return;
    setSaving(true);
    const res = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: prefs.email,
        email_opt_in: emailOptIn,
        sms_opt_in: false,
      }),
    });
    setSaving(false);
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
            <label className="field-label">Email notifications</label>
            {([
              { v: true, label: "Email me about my classes" },
              { v: false, label: "Don't email me" },
            ] as const).map((opt) => (
              <label key={String(opt.v)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, padding: "6px 0", cursor: "pointer" }}>
                <input type="radio" name="email_opt_in" checked={emailOptIn === opt.v} onChange={() => setEmailOptIn(opt.v)} />
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
