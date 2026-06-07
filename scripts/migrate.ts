/**
 * One-time migration: Firebase Realtime Database → Supabase
 *
 * Usage:
 *   npx tsx scripts/migrate.ts [path/to/firebase-export.json] [--dry-run]
 *
 * Defaults:
 *   export file  → scripts/firebase-export.json
 *   --dry-run    → validates and counts without writing to Supabase
 *
 * The script reads .env.local automatically. Run from the project root.
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ──────────────────────────────────────────────────────────
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* no .env.local — env vars must be set externally */ }

// ── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const exportPath = args.find((a) => !a.startsWith("--")) ?? "scripts/firebase-export.json";

// ── Supabase client ───────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Read Firebase export ──────────────────────────────────────────────────────
let firebase: Record<string, unknown>;
try {
  firebase = JSON.parse(readFileSync(exportPath, "utf8"));
} catch {
  console.error(`✗ Cannot read ${exportPath}`);
  console.error("  Download from Firebase console → Realtime Database → ⋮ → Export JSON");
  process.exit(1);
}

console.log(`\n${DRY_RUN ? "🔍 DRY RUN — nothing will be written\n" : ""}Reading from: ${exportPath}\n`);

// ── Field name helpers ────────────────────────────────────────────────────────
// Firebase uses camelCase; Supabase uses snake_case
function normSlot(s: Record<string, unknown>) {
  return {
    day:        s.day as number,
    time:       s.time as string,
    end_time:   (s.end_time ?? s.endTime ?? null) as string | null,
    class_name: (s.class_name ?? s.className ?? "") as string,
    location:   (s.location ?? null) as string | null,
    capacity:   (s.capacity ?? 10) as number,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // ── 1. Classes ──────────────────────────────────────────────────────────────
  const schedule = (firebase.schedule ?? {}) as Record<string, Record<string, unknown>>;
  const classEntries = Object.entries(schedule);
  console.log(`Classes in Firebase:  ${classEntries.length}`);

  let classesMigrated = 0, classesSkipped = 0;
  for (const [id, slot] of classEntries) {
    const row = { id, ...normSlot(slot) };
    if (!row.class_name) { console.warn(`  ⚠ Skipping class ${id} — missing class_name`); classesSkipped++; continue; }
    if (DRY_RUN) { classesMigrated++; continue; }
    const { error } = await db.from("classes").upsert(row, { onConflict: "id" });
    if (error) { console.error(`  ✗ Class ${id}: ${error.message}`); classesSkipped++; }
    else classesMigrated++;
  }
  console.log(`Classes migrated:     ${classesMigrated}${classesSkipped ? `  (${classesSkipped} skipped)` : ""}`);

  // ── 2. Signups ───────────────────────────────────────────────────────────────
  const signupsTree = (firebase.signups ?? {}) as Record<string, Record<string, Record<string, Record<string, unknown>>>>;

  // Flatten Firebase's 3-level-deep tree into flat rows
  const fbSignups: { week_key: string; class_id: string; name: string; email: string; signed_up_at: string }[] = [];
  for (const [weekKey, slots] of Object.entries(signupsTree)) {
    for (const [classId, entries] of Object.entries(slots)) {
      for (const entry of Object.values(entries)) {
        if (!entry?.name || !entry?.email) continue;
        fbSignups.push({
          week_key:     weekKey,
          class_id:     classId,
          name:         entry.name as string,
          email:        (entry.email as string).toLowerCase(),
          signed_up_at: entry.timestamp
            ? new Date(entry.timestamp as number).toISOString()
            : new Date().toISOString(),
        });
      }
    }
  }
  console.log(`\nSignups in Firebase:  ${fbSignups.length}`);

  let signupsMigrated = 0, signupsDupes = 0;
  if (!DRY_RUN) {
    // Fetch existing (week_key, class_id, email) combos to avoid duplicates
    const { data: existing } = await db.from("signups").select("week_key, class_id, email");
    const seen = new Set((existing ?? []).map((r: { week_key: string; class_id: string; email: string }) => `${r.week_key}|${r.class_id}|${r.email}`));

    const toInsert = fbSignups.filter((s) => {
      const key = `${s.week_key}|${s.class_id}|${s.email}`;
      if (seen.has(key)) { signupsDupes++; return false; }
      seen.add(key);
      return true;
    });

    // Batch insert in chunks of 200
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error } = await db.from("signups").insert(chunk);
      if (error) { console.error(`  ✗ Signups chunk at ${i}: ${error.message}`); continue; }
      signupsMigrated += chunk.length;
      process.stdout.write(`\r  Inserted ${signupsMigrated} / ${toInsert.length}…`);
    }
    if (toInsert.length) process.stdout.write("\n");
  } else {
    signupsMigrated = fbSignups.length;
  }
  console.log(`Signups migrated:     ${signupsMigrated}${signupsDupes ? `  (${signupsDupes} already in Supabase)` : ""}`);

  // ── 3. Overrides ─────────────────────────────────────────────────────────────
  const overridesTree = (firebase.overrides ?? {}) as Record<string, Record<string, Record<string, unknown>>>;

  const overrideRows: Record<string, unknown>[] = [];
  for (const [weekKey, slots] of Object.entries(overridesTree)) {
    for (const [classId, ov] of Object.entries(slots)) {
      overrideRows.push({
        week_key:   weekKey,
        class_id:   classId,
        cancelled:  ov.cancelled ?? false,
        time:       ov.time ?? null,
        end_time:   ov.end_time ?? ov.endTime ?? null,
        class_name: ov.class_name ?? ov.className ?? null,
        location:   ov.location ?? null,
        capacity:   ov.capacity ?? null,
      });
    }
  }
  console.log(`\nOverrides in Firebase: ${overrideRows.length}`);

  let overridesMigrated = 0, overridesSkipped = 0;
  if (!DRY_RUN) {
    for (let i = 0; i < overrideRows.length; i += 200) {
      const chunk = overrideRows.slice(i, i + 200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db.from("overrides") as any).upsert(chunk, { onConflict: "week_key,class_id" });
      if (error) { console.error(`  ✗ Overrides chunk at ${i}: ${error.message}`); overridesSkipped += chunk.length; continue; }
      overridesMigrated += chunk.length;
    }
  } else {
    overridesMigrated = overrideRows.length;
  }
  console.log(`Overrides migrated:   ${overridesMigrated}${overridesSkipped ? `  (${overridesSkipped} failed)` : ""}`);

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n${DRY_RUN ? "✓ Dry run complete — no data was written." : "✓ Migration complete."}`);
  if (!DRY_RUN) {
    console.log("\nNext: open the preview URL and verify the schedule looks correct.");
    console.log("Then run: npx vercel deploy --prod");
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
