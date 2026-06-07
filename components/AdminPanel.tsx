"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import {
  DAYS, DISPLAY_ORDER, getWeekKey, fmtTimeRange, fmtDate, getEffectiveClass, getSlotDate,
} from "@/lib/dates";
import type { Class, Signup, Override, SignupMap, OverrideMap } from "@/lib/types";
import WeekNav from "./WeekNav";

const PRESET_LOCATIONS = ["102 West 80th St", "21 West End Ave", "Turtle Pond / Central Park", "Zoom"];

const DAY_OPTIONS = [
  { value: 6, label: "Sunday" },
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
];

type EditForm = { time: string; end_time: string; class_name: string; location: string; capacity: string };
type NewForm  = { day: string; time: string; end_time: string; class_name: string; location: string; capacity: string };

const DEFAULT_NEW: NewForm = { day: "0", time: "10:00", end_time: "", class_name: "Ashtanga Open Practice", location: "", capacity: "10" };

function LocationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isPreset = PRESET_LOCATIONS.includes(value);
  const selectVal = isPreset || value === "" ? value : "Other";
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select
        className="input-field"
        value={selectVal}
        onChange={(e) => onChange(e.target.value === "Other" ? "" : e.target.value)}
        style={{ flex: 1 }}
      >
        <option value="">Select location…</option>
        {PRESET_LOCATIONS.map((l) => <option key={l}>{l}</option>)}
        <option value="Other">Other…</option>
      </select>
      {selectVal === "Other" && (
        <input
          className="input-field"
          type="text"
          placeholder="Enter location"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 2 }}
          autoFocus
        />
      )}
    </div>
  );
}

type Props = { initialClasses: Class[] };

export default function AdminPanel({ initialClasses }: Props) {
  const [weekKey, setWeekKey]     = useState(getWeekKey(new Date()));
  const [classes, setClasses]     = useState<Class[]>(initialClasses);
  const [signups, setSignups]     = useState<SignupMap>({});
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState("");

  // Per-class UI state
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editForm, setEditForm]     = useState<EditForm | null>(null);
  const [viewingId, setViewingId]   = useState<string | null>(null);
  const [emailClassForm, setEmailClassForm] = useState<{ subject: string; body: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // class id

  // Add new class
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState<NewForm>(DEFAULT_NEW);
  const [addLoading, setAddLoading] = useState(false);

  // Broadcast / reminder
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ subject: "", body: "" });
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  const fetchWeekData = useCallback(async (key: string) => {
    setLoading(true);
    const [sRes, oRes] = await Promise.all([
      fetch(`/api/signups?week=${key}`),
      fetch(`/api/overrides?week=${key}`),
    ]);
    const [signupRows, overrideRows]: [Signup[], Override[]] = await Promise.all([
      sRes.json(),
      oRes.json(),
    ]);
    const sm: SignupMap = {};
    for (const s of signupRows) (sm[s.class_id] ??= []).push(s);
    const om: OverrideMap = {};
    for (const o of overrideRows) om[o.class_id] = o;
    setSignups(sm);
    setOverrides(om);
    setLoading(false);
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    fetchWeekData(weekKey);

    const sigCh = supabase.channel(`admin-signups-${weekKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "signups", filter: `week_key=eq.${weekKey}` }, (payload) => {
        const signup = (payload.new ?? payload.old) as Signup;
        setSignups((prev) => {
          const map = { ...prev };
          const list = [...(map[signup.class_id] ?? [])];
          if (payload.eventType === "INSERT") list.push(signup);
          else { const i = list.findIndex((s) => s.id === signup.id); if (i !== -1) list.splice(i, 1); }
          map[signup.class_id] = list;
          return map;
        });
      }).subscribe();

    const ovCh = supabase.channel(`admin-overrides-${weekKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "overrides", filter: `week_key=eq.${weekKey}` }, (payload) => {
        const ov = (payload.new ?? payload.old) as Override;
        setOverrides((prev) => {
          const map = { ...prev };
          if (payload.eventType === "DELETE") delete map[ov.class_id];
          else map[ov.class_id] = ov;
          return map;
        });
      }).subscribe();

    return () => {
      supabase.removeChannel(sigCh);
      supabase.removeChannel(ovCh);
    };
  }, [weekKey, fetchWeekData]);

  function handleWeekChange(key: string) {
    setWeekKey(key);
    setEditingId(null);
    setViewingId(null);
    setEmailClassForm(null);
  }

  // ── Sorted class list ────────────────────────────────────────────────────
  const sortedClasses = [...classes].sort((a, b) => {
    const dayA = DISPLAY_ORDER.indexOf(a.day);
    const dayB = DISPLAY_ORDER.indexOf(b.day);
    if (dayA !== dayB) return dayA - dayB;
    return a.time.localeCompare(b.time);
  });

  // ── Edit this week ───────────────────────────────────────────────────────
  function startEdit(cls: Class) {
    const eff = getEffectiveClass(cls, overrides) ?? cls;
    setEditForm({
      time:       eff.time,
      end_time:   eff.end_time ?? "",
      class_name: eff.class_name,
      location:   eff.location ?? "",
      capacity:   String(eff.capacity),
    });
    setEditingId(cls.id);
    setViewingId(null);
  }

  async function saveEdit(cls: Class) {
    if (!editForm) return;
    setActionLoading(cls.id);
    const res = await fetch("/api/overrides", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        week_key:   weekKey,
        class_id:   cls.id,
        cancelled:  false,
        time:       editForm.time || null,
        end_time:   editForm.end_time || null,
        class_name: editForm.class_name.trim() || null,
        location:   editForm.location || null,
        capacity:   parseInt(editForm.capacity) || cls.capacity,
      }),
    });
    setActionLoading(null);
    if (!res.ok) { showToast("Failed to save changes."); return; }
    setEditingId(null);
    setEditForm(null);
    showToast("Updated for this week. Students notified.");
  }

  async function cancelThisWeek(cls: Class) {
    if (!confirm(`Cancel "${cls.class_name}" for this week? Students will be notified.`)) return;
    setActionLoading(cls.id);
    const eff = getEffectiveClass(cls, overrides) ?? cls;
    const res = await fetch("/api/overrides", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        week_key:   weekKey,
        class_id:   cls.id,
        cancelled:  true,
        time:       eff.time,
        end_time:   eff.end_time,
        class_name: eff.class_name,
        location:   eff.location,
        capacity:   eff.capacity,
      }),
    });
    setActionLoading(null);
    if (!res.ok) { showToast("Failed to cancel class."); return; }
    showToast("Class cancelled. Students notified.");
  }

  async function resetOverride(cls: Class) {
    setActionLoading(cls.id);
    const res = await fetch(`/api/overrides?week_key=${encodeURIComponent(weekKey)}&class_id=${encodeURIComponent(cls.id)}`, { method: "DELETE" });
    setActionLoading(null);
    if (!res.ok) { showToast("Failed to reset override."); return; }
    showToast("Reset to regular schedule.");
  }

  async function deleteForever(cls: Class) {
    if (!confirm(`Permanently remove "${cls.class_name}"? This cannot be undone.`)) return;
    setActionLoading(cls.id);
    const res = await fetch(`/api/classes?id=${encodeURIComponent(cls.id)}`, { method: "DELETE" });
    setActionLoading(null);
    if (!res.ok) { showToast("Failed to delete class."); return; }
    setClasses((prev) => prev.filter((c) => c.id !== cls.id));
    showToast("Class permanently removed.");
  }

  // ── Add new class ────────────────────────────────────────────────────────
  async function addNewClass() {
    if (!newForm.class_name.trim()) { showToast("Please enter a class name."); return; }
    setAddLoading(true);
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        day:        parseInt(newForm.day),
        time:       newForm.time,
        end_time:   newForm.end_time || null,
        class_name: newForm.class_name.trim(),
        location:   newForm.location || null,
        capacity:   parseInt(newForm.capacity) || 10,
      }),
    });
    setAddLoading(false);
    if (!res.ok) { showToast("Failed to add class."); return; }
    const created: Class = await res.json();
    setClasses((prev) => [...prev, created]);
    setNewForm(DEFAULT_NEW);
    setShowAdd(false);
    showToast("Class added!");
  }

  // ── Remove individual signup ─────────────────────────────────────────────
  async function removeSignup(signupId: string) {
    const res = await fetch(`/api/signups?id=${encodeURIComponent(signupId)}`, { method: "DELETE" });
    if (!res.ok) showToast("Failed to remove signup.");
  }

  // ── Email all students in a class ────────────────────────────────────────
  async function sendEmailClass(classId: string) {
    if (!emailClassForm?.subject.trim() || !emailClassForm?.body.trim()) {
      showToast("Please enter a subject and message.");
      return;
    }
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;
    const eff = getEffectiveClass(cls, overrides) ?? cls;
    const students = signups[classId] ?? [];
    if (!students.length) { showToast("No students to email."); return; }

    setActionLoading(`email-${classId}`);
    let sent = 0, failed = 0;
    for (const s of students) {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to:          s.email,
          toName:      s.name,
          subject:     `${emailClassForm.subject} — ${eff.class_name}`,
          htmlContent: emailClassForm.body,
        }),
      });
      if (res.ok) sent++; else failed++;
    }
    setActionLoading(null);
    setEmailClassForm(null);
    showToast(`Sent ${sent}${failed ? `, ${failed} failed` : ""}.`);
  }

  // ── Broadcast to all students ever ───────────────────────────────────────
  async function sendBroadcast() {
    if (!broadcastForm.subject.trim() || !broadcastForm.body.trim()) {
      showToast("Please enter a subject and message.");
      return;
    }
    if (!confirm("Send to ALL students who have ever signed up?")) return;
    setBroadcastLoading(true);
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "broadcast", subject: broadcastForm.subject, message: broadcastForm.body }),
    });
    setBroadcastLoading(false);
    if (!res.ok) { showToast("Broadcast failed."); return; }
    const { sent, failed } = await res.json();
    setBroadcastForm({ subject: "", body: "" });
    setShowBroadcast(false);
    showToast(`Sent ${sent}${failed ? `, ${failed} failed` : ""}.`);
  }

  // ── Weekly reminder ──────────────────────────────────────────────────────
  async function sendReminder() {
    if (!confirm("Send weekly schedule reminder to ALL students ever?")) return;
    setReminderLoading(true);
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "reminder", week_key: weekKey }),
    });
    setReminderLoading(false);
    if (!res.ok) { showToast("Reminder failed."); return; }
    const { sent, failed } = await res.json();
    showToast(`Reminder sent to ${sent}${failed ? `, ${failed} failed` : ""}.`);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2" }}>
      {/* Admin header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-top">
            <div className="header-brand">
              <img className="header-logo" src="/icon-192.png" alt="AOP Shala NYC" />
              <div>
                <div className="header-title">Admin Panel</div>
                <div className="header-sub">AOP Shala NYC</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Link href="/" style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, textDecoration: "none" }}>
                ← Schedule
              </Link>
              <UserButton />
            </div>
          </div>
          <WeekNav weekKey={weekKey} onChange={handleWeekChange} />
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── Email tools ─────────────────────────────────────────────────── */}
        <div style={{ background: "white", borderRadius: 12, padding: "18px 20px", marginBottom: 18, border: "1.5px solid #e8dfd4" }}>
          <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Email Tools</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn-cancel"
              style={{ fontSize: 13 }}
              onClick={() => setShowBroadcast((v) => !v)}
            >
              📧 Broadcast to All Students
            </button>
            <button
              className="btn-cancel"
              style={{ fontSize: 13 }}
              disabled={reminderLoading}
              onClick={sendReminder}
            >
              {reminderLoading ? "Sending…" : "📅 Weekly Reminder"}
            </button>
          </div>

          {showBroadcast && (
            <div style={{ marginTop: 14, borderTop: "1px solid #f0e8e0", paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: "#9a7d5e", marginBottom: 10 }}>
                Send to everyone who has ever signed up for a class.
              </div>
              <input
                className="input-field"
                type="text"
                placeholder="Subject"
                value={broadcastForm.subject}
                onChange={(e) => setBroadcastForm((f) => ({ ...f, subject: e.target.value }))}
                style={{ marginBottom: 8 }}
              />
              <textarea
                className="input-field"
                placeholder="Message…"
                value={broadcastForm.body}
                onChange={(e) => setBroadcastForm((f) => ({ ...f, body: e.target.value }))}
                style={{ minHeight: 90, resize: "vertical", marginBottom: 10, lineHeight: 1.5 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-primary" onClick={sendBroadcast} disabled={broadcastLoading}>
                  {broadcastLoading ? "Sending…" : "Send →"}
                </button>
                <button className="btn-cancel" onClick={() => setShowBroadcast(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Class list ──────────────────────────────────────────────────── */}
        <div style={{ background: "white", borderRadius: 12, padding: "18px 20px", marginBottom: 18, border: "1.5px solid #e8dfd4" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px" }}>Classes</div>
            <button
              className="btn-primary"
              style={{ fontSize: 12, padding: "6px 14px" }}
              onClick={() => setShowAdd((v) => !v)}
            >
              {showAdd ? "✕ Cancel" : "+ Add Class"}
            </button>
          </div>

          {/* Add class form */}
          {showAdd && (
            <div style={{ background: "#faf7f2", borderRadius: 10, padding: "16px", marginBottom: 16, border: "1px solid #ede5dc" }}>
              <div style={{ fontSize: 12, color: "#9a7d5e", marginBottom: 12, fontWeight: 600 }}>New Class</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div>
                  <label className="field-label">Day</label>
                  <select className="input-field" value={newForm.day} onChange={(e) => setNewForm((f) => ({ ...f, day: e.target.value }))}>
                    {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Capacity</label>
                  <input className="input-field" type="number" min={1} value={newForm.capacity} onChange={(e) => setNewForm((f) => ({ ...f, capacity: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Start Time</label>
                  <input className="input-field" type="time" value={newForm.time} onChange={(e) => setNewForm((f) => ({ ...f, time: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">End Time</label>
                  <input className="input-field" type="time" value={newForm.end_time} onChange={(e) => setNewForm((f) => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label className="field-label">Class Name</label>
                <input className="input-field" type="text" value={newForm.class_name} onChange={(e) => setNewForm((f) => ({ ...f, class_name: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="field-label">Location</label>
                <LocationField value={newForm.location} onChange={(v) => setNewForm((f) => ({ ...f, location: v }))} />
              </div>
              <button className="btn-primary" onClick={addNewClass} disabled={addLoading}>
                {addLoading ? "Adding…" : "+ Add Class"}
              </button>
            </div>
          )}

          {/* Class rows */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 24, color: "#aaa" }}><span className="spinner" /> Loading…</div>
          ) : sortedClasses.length === 0 ? (
            <div style={{ color: "#bbb", fontSize: 13 }}>No classes yet. Add one above.</div>
          ) : sortedClasses.map((cls) => {
            const ov = overrides[cls.id];
            const cancelled = ov?.cancelled;
            const eff = getEffectiveClass(cls, overrides) ?? cls;
            const classSignups = signups[cls.id] ?? [];
            const isEditing  = editingId === cls.id;
            const isViewing  = viewingId === cls.id;
            const isLoading  = actionLoading === cls.id;
            const slotDate   = getSlotDate(cls.day, weekKey);

            return (
              <div key={cls.id} style={{ borderBottom: "1px solid #f0e8e0", paddingBottom: 14, marginBottom: 14 }}>
                {/* Class summary row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#3d2e1e" }}>
                      {eff.class_name}
                      {ov && !cancelled && <span style={{ marginLeft: 8, fontSize: 11, background: "#fff3e0", color: "#c4956a", borderRadius: 20, padding: "2px 8px", fontWeight: 500 }}>Modified</span>}
                      {cancelled && <span style={{ marginLeft: 8, fontSize: 11, background: "#fde8e8", color: "#e07070", borderRadius: 20, padding: "2px 8px", fontWeight: 500 }}>Cancelled</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "#9a7d5e", marginTop: 2 }}>
                      {DAYS[cls.day]} · {fmtTimeRange(eff.time, eff.end_time)} · {fmtDate(slotDate)}
                    </div>
                    {eff.location && <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>📍 {eff.location}</div>}
                  </div>

                  {/* Signup count */}
                  <button
                    onClick={() => { setViewingId(isViewing ? null : cls.id); setEmailClassForm(null); setEditingId(null); }}
                    style={{ background: "none", border: "1.5px solid #e8dfd4", borderRadius: 20, padding: "3px 12px", fontSize: 12, cursor: "pointer", color: "#9a7d5e", whiteSpace: "nowrap" }}
                  >
                    {classSignups.length} / {eff.capacity} {isViewing ? "▲" : "▼"}
                  </button>
                </div>

                {/* Action buttons */}
                {!isEditing && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {!cancelled && (
                      <button
                        className="btn-cancel"
                        style={{ fontSize: 12, padding: "5px 11px" }}
                        onClick={() => startEdit(cls)}
                        disabled={isLoading}
                      >
                        Edit This Week
                      </button>
                    )}
                    {!cancelled && (
                      <button
                        className="btn-cancel"
                        style={{ fontSize: 12, padding: "5px 11px", color: "#e07070", borderColor: "#e07070" }}
                        onClick={() => cancelThisWeek(cls)}
                        disabled={isLoading}
                      >
                        Cancel This Week
                      </button>
                    )}
                    {ov && (
                      <button
                        className="btn-cancel"
                        style={{ fontSize: 12, padding: "5px 11px" }}
                        onClick={() => resetOverride(cls)}
                        disabled={isLoading}
                      >
                        Reset to Base
                      </button>
                    )}
                    <button
                      className="btn-cancel"
                      style={{ fontSize: 12, padding: "5px 11px", color: "#c44", borderColor: "#c44" }}
                      onClick={() => deleteForever(cls)}
                      disabled={isLoading}
                    >
                      {isLoading ? "…" : "Remove Forever"}
                    </button>
                  </div>
                )}

                {/* Inline edit form */}
                {isEditing && editForm && (
                  <div style={{ marginTop: 10, background: "#faf7f2", borderRadius: 10, padding: "14px 16px", border: "1px solid #ede5dc" }}>
                    <div style={{ fontSize: 12, color: "#9a7d5e", marginBottom: 10, fontWeight: 600 }}>Override for this week only</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label className="field-label">Start Time</label>
                        <input className="input-field" type="time" value={editForm.time} onChange={(e) => setEditForm((f) => f && ({ ...f, time: e.target.value }))} />
                      </div>
                      <div>
                        <label className="field-label">End Time</label>
                        <input className="input-field" type="time" value={editForm.end_time} onChange={(e) => setEditForm((f) => f && ({ ...f, end_time: e.target.value }))} />
                      </div>
                      <div>
                        <label className="field-label">Class Name</label>
                        <input className="input-field" type="text" value={editForm.class_name} onChange={(e) => setEditForm((f) => f && ({ ...f, class_name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="field-label">Capacity</label>
                        <input className="input-field" type="number" min={1} value={editForm.capacity} onChange={(e) => setEditForm((f) => f && ({ ...f, capacity: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label className="field-label">Location</label>
                      <LocationField value={editForm.location} onChange={(v) => setEditForm((f) => f && ({ ...f, location: v }))} />
                    </div>
                    <div style={{ fontSize: 12, color: "#bbb", marginBottom: 10 }}>Students signed up will be notified of changes.</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => saveEdit(cls)} disabled={isLoading}>
                        {isLoading ? "Saving…" : "Save →"}
                      </button>
                      <button className="btn-cancel" style={{ fontSize: 13 }} onClick={() => { setEditingId(null); setEditForm(null); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* View signups panel */}
                {isViewing && (
                  <div style={{ marginTop: 10, background: "#faf7f2", borderRadius: 10, padding: "14px 16px", border: "1px solid #ede5dc" }}>
                    {classSignups.length === 0 ? (
                      <div style={{ color: "#bbb", fontSize: 13 }}>No signups for this class this week.</div>
                    ) : (
                      <>
                        {classSignups.map((s) => (
                          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #ede5dc" }}>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</div>
                              <div style={{ fontSize: 12, color: "#9a7d5e" }}>{s.email}</div>
                            </div>
                            <button
                              className="btn-cancel"
                              style={{ fontSize: 11, padding: "3px 10px", color: "#c44", borderColor: "#c44" }}
                              onClick={() => removeSignup(s.id)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <div style={{ marginTop: 12 }}>
                          {emailClassForm === null ? (
                            <button
                              className="btn-cancel"
                              style={{ fontSize: 12 }}
                              onClick={() => setEmailClassForm({ subject: "", body: "" })}
                            >
                              📧 Email All Signed Up
                            </button>
                          ) : (
                            <div>
                              <input
                                className="input-field"
                                type="text"
                                placeholder="Subject"
                                value={emailClassForm.subject}
                                onChange={(e) => setEmailClassForm((f) => f && ({ ...f, subject: e.target.value }))}
                                style={{ marginBottom: 8 }}
                                autoFocus
                              />
                              <textarea
                                className="input-field"
                                placeholder="Message…"
                                value={emailClassForm.body}
                                onChange={(e) => setEmailClassForm((f) => f && ({ ...f, body: e.target.value }))}
                                style={{ minHeight: 80, resize: "vertical", marginBottom: 8, lineHeight: 1.5 }}
                              />
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  className="btn-primary"
                                  style={{ fontSize: 13 }}
                                  disabled={actionLoading === `email-${cls.id}`}
                                  onClick={() => sendEmailClass(cls.id)}
                                >
                                  {actionLoading === `email-${cls.id}` ? "Sending…" : "Send →"}
                                </button>
                                <button className="btn-cancel" style={{ fontSize: 13 }} onClick={() => setEmailClassForm(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#3d2e1e", color: "white", padding: "10px 20px", borderRadius: 10,
          fontSize: 14, zIndex: 1000, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
