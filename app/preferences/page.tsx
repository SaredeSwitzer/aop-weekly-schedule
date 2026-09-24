"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import StudentPushToggle from "@/components/StudentPushToggle";

type Prefs = { email: string; email_opt_in: boolean; sms_opt_in: boolean };

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

// The email this device already knows — from a past signup or push opt-in —
// so returning students land straight on their current settings.
function knownEmail(): string {
  try {
    const user = JSON.parse(localStorage.getItem("yoga_user") || "null");
    return user?.email ?? localStorage.getItem("yoga_push_email") ?? "";
  } catch {
    return "";
  }
}

function PreferencesForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
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
    // Texting was removed — anyone who'd picked text-only is emailed instead.
    setEmailOptIn(data.email_opt_in || data.sms_opt_in);
  }

  useEffect(() => {
    const e = params.get("email") || knownEmail();
    if (!e) return;
    queueMicrotask(() => { setEmail(e); load(e); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleEmail() {
    if (!prefs) return;
    const next = !emailOptIn;
    setEmailOptIn(next);
    setSaving(true);
    const res = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: prefs.email, email_opt_in: next, sms_opt_in: false }),
    });
    setSaving(false);
    if (!res.ok) {
      setEmailOptIn(!next);
      setToast("Something went wrong. Please try again.");
      return;
    }
    setToast(next ? "✓ Email notifications on." : "✓ Email notifications off.");
  }

  function switchEmail() {
    setPrefs(null);
    setEmail("");
    setToast("");
  }

  return (
    <div style={{ maxWidth: 420, margin: "24px auto 40px", padding: "0 20px" }}>
      <Link href="/" style={{ display: "inline-block", fontSize: 14, color: "#9a7d5e", textDecoration: "none", marginBottom: 16 }}>
        ← Back to schedule
      </Link>

      <h3 style={{ marginBottom: 4 }}>My Notifications</h3>
      <div style={{ fontSize: 13, color: "#9a7d5e", marginBottom: 20 }}>
        Choose how you&apos;d like to hear about your classes and schedule changes.
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
          <div style={{ fontSize: 13, color: "#888", marginBottom: 14 }}>
            Settings for <strong>{prefs.email}</strong>{" "}
            <button onClick={switchEmail} style={{ background: "none", border: "none", fontSize: 12, color: "#c4956a", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Not you?
            </button>
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", cursor: "pointer" }}>
            <input type="checkbox" style={{ marginTop: 3, width: 18, height: 18 }}
              checked={emailOptIn} disabled={saving} onChange={toggleEmail} />
            <span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Email</span>
              <span style={{ display: "block", fontSize: 12, color: "#888", marginTop: 2 }}>
                Signup confirmations, class changes and cancellations, and studio messages.
              </span>
            </span>
          </label>

          <StudentPushToggle
            email={prefs.email}
            showToast={(msg, ok = true) => setToast(ok ? `✓ ${msg}` : msg)}
          />

          {toast && <div style={{ color: toast.startsWith("✓") ? "#2a7a3d" : "#c44", fontSize: 13, marginTop: 12 }}>{toast}</div>}
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
