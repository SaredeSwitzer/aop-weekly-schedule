"use client";

import { useEffect, useState } from "react";
import type { Student, Package } from "@/lib/types";

type PackageFormState = {
  total_classes: string;
  used_classes: string;
  notes: string;
};

function PackageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(1, used / total) : 0;
  const remaining = total - used;
  const color = remaining <= 0 ? "#e07070" : remaining <= 2 ? "#c4956a" : "#4a7c59";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
      <div style={{ flex: 1, height: 6, background: "#e8dfd4", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600, whiteSpace: "nowrap" }}>
        {used}/{total}
        {remaining <= 0
          ? " · ⚠️ empty"
          : remaining <= 2
          ? ` · ${remaining} left`
          : ` · ${remaining} remaining`}
      </span>
    </div>
  );
}

type Props = {
  showToast: (msg: string, ok?: boolean) => void;
};

export default function StudentsSection({ showToast }: Props) {
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [form, setForm] = useState<PackageFormState>({ total_classes: "", used_classes: "0", notes: "" });
  const [saving, setSaving] = useState(false);

  // Load packages eagerly so the badge shows without opening the section
  useEffect(() => {
    fetch("/api/packages")
      .then((r) => r.json())
      .then((p: Package[]) => setPackages(p))
      .catch(() => {});
  }, []);

  async function load() {
    if (loaded) return;
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      fetch("/api/students"),
      fetch("/api/packages"),
    ]);
    const [s, p]: [Student[], Package[]] = await Promise.all([sRes.json(), pRes.json()]);
    setStudents(s.sort((a, b) => a.name.localeCompare(b.name)));
    setPackages(p);
    setLoaded(true);
    setLoading(false);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  function pkgFor(email: string): Package | undefined {
    return packages.find((p) => p.student_email === email.toLowerCase());
  }

  function startEdit(student: Student) {
    const pkg = pkgFor(student.email);
    setForm({
      total_classes: pkg ? String(pkg.total_classes) : "",
      used_classes:  pkg ? String(pkg.used_classes)  : "0",
      notes:         pkg?.notes ?? "",
    });
    setEditingEmail(student.email);
  }

  async function savePackage(student: Student) {
    const total = parseInt(form.total_classes);
    const used  = parseInt(form.used_classes);
    if (!total || total < 1) { showToast("Total classes must be at least 1.", false); return; }
    if (isNaN(used) || used < 0) { showToast("Used classes can't be negative.", false); return; }

    setSaving(true);
    const existing = pkgFor(student.email);

    if (existing) {
      const res = await fetch("/api/packages", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: existing.id, total_classes: total, used_classes: used, notes: form.notes || null, student_name: student.name }),
      });
      if (!res.ok) { showToast("Failed to update package.", false); setSaving(false); return; }
      const updated: Package = await res.json();
      setPackages((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      showToast("Package updated.");
    } else {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_email: student.email, student_name: student.name, total_classes: total, used_classes: used, notes: form.notes || null }),
      });
      if (res.status === 409) { showToast("This student already has a package.", false); setSaving(false); return; }
      if (!res.ok) { showToast("Failed to create package.", false); setSaving(false); return; }
      const created: Package = await res.json();
      setPackages((prev) => [...prev, created]);
      showToast("Package created.");
    }

    setSaving(false);
    setEditingEmail(null);
  }

  async function deletePackage(student: Student) {
    const pkg = pkgFor(student.email);
    if (!pkg) return;
    if (!confirm(`Remove package for ${student.name}?`)) return;

    setSaving(true);
    const res = await fetch(`/api/packages?id=${encodeURIComponent(pkg.id)}`, { method: "DELETE" });
    setSaving(false);

    if (!res.ok) { showToast("Failed to delete package.", false); return; }
    setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
    setEditingEmail(null);
    showToast("Package removed.");
  }

  const emptyPackageCount = packages.filter((p) => p.used_classes >= p.total_classes).length;

  return (
    <div style={{ background: "white", borderRadius: 12, padding: "18px 20px", marginBottom: 18, border: "1.5px solid #e8dfd4" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Students & Packages
          </div>
          {emptyPackageCount > 0 && (
            <span style={{ fontSize: 11, background: "#fde8e8", color: "#e07070", borderRadius: 20, padding: "2px 8px", fontWeight: 600 }}>
              {emptyPackageCount} package{emptyPackageCount !== 1 ? "s" : ""} empty
            </span>
          )}
        </div>
        <button
          className="btn-cancel"
          style={{ fontSize: 12, padding: "5px 12px" }}
          onClick={toggle}
        >
          {open ? "▲ Hide" : "▼ View"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24, color: "#aaa" }}><span className="spinner" /> Loading…</div>
          ) : students.length === 0 ? (
            <div style={{ color: "#bbb", fontSize: 13 }}>No students have signed up yet.</div>
          ) : students.map((student) => {
            const pkg = pkgFor(student.email);
            const isEditing = editingEmail === student.email;

            return (
              <div key={student.email} style={{ borderBottom: "1px solid #f0e8e0", paddingBottom: 14, marginBottom: 14 }}>
                {/* Student row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#3d2e1e" }}>{student.name}</div>
                    <div style={{ fontSize: 12, color: "#9a7d5e" }}>{student.email}</div>
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>
                      {student.signup_count} class{student.signup_count !== 1 ? "es" : ""} total
                    </div>
                    {pkg && !isEditing && <PackageBar used={pkg.used_classes} total={pkg.total_classes} />}
                    {pkg?.notes && !isEditing && (
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 3, fontStyle: "italic" }}>{pkg.notes}</div>
                    )}
                  </div>
                  {!isEditing && (
                    <button
                      className="btn-cancel"
                      style={{ fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }}
                      onClick={() => startEdit(student)}
                    >
                      {pkg ? "Edit Package" : "+ Package"}
                    </button>
                  )}
                </div>

                {/* Inline package form */}
                {isEditing && (
                  <div style={{ marginTop: 10, background: "#faf7f2", borderRadius: 10, padding: "14px 16px", border: "1px solid #ede5dc" }}>
                    <div style={{ fontSize: 12, color: "#9a7d5e", fontWeight: 600, marginBottom: 10 }}>
                      {pkg ? "Edit Package" : "New Package"} — {student.name}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label className="field-label">Total Classes in Pack</label>
                        <input
                          className="input-field"
                          type="number"
                          min={1}
                          placeholder="e.g. 10"
                          value={form.total_classes}
                          onChange={(e) => setForm((f) => ({ ...f, total_classes: e.target.value }))}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="field-label">Already Used</label>
                        <input
                          className="input-field"
                          type="number"
                          min={0}
                          value={form.used_classes}
                          onChange={(e) => setForm((f) => ({ ...f, used_classes: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label className="field-label">Notes (optional)</label>
                      <input
                        className="input-field"
                        type="text"
                        placeholder="e.g. Purchased June 2026"
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => savePackage(student)} disabled={saving}>
                        {saving ? "Saving…" : "Save →"}
                      </button>
                      {pkg && (
                        <button
                          className="btn-cancel"
                          style={{ fontSize: 13, color: "#c44", borderColor: "#c44" }}
                          onClick={() => deletePackage(student)}
                          disabled={saving}
                        >
                          Remove Package
                        </button>
                      )}
                      <button className="btn-cancel" style={{ fontSize: 13 }} onClick={() => setEditingEmail(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
