import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { fmtTimeRange, fmtDateLong, getSlotDate, getWeekKey } from "@/lib/dates";
import { notifyStudentsClassUpdate } from "@/lib/email";

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("classes")
    .select("*")
    .order("day")
    .order("time");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { day, time, end_time, class_name, location, capacity } = await req.json();
  if (day == null || !time || !class_name?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const id = Date.now().toString();
  const { data, error } = await db
    .from("classes")
    .insert({ id, day, time, end_time: end_time || null, class_name: class_name.trim(), location: location?.trim() || null, capacity: capacity || 10 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: before } = await db.from("classes").select("*").eq("id", id).single();
  const { data, error } = await db.from("classes").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (before && detailsChanged(before, data)) after(notifyUpcomingSignups(data).catch(console.error));
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from("classes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

const NOTIFY_FIELDS = ["day", "time", "end_time", "class_name", "location"] as const;

function detailsChanged(before: Record<string, unknown>, after: Record<string, unknown>) {
  return NOTIFY_FIELDS.some((f) => (before[f] ?? null) !== (after[f] ?? null));
}

// A permanent edit changes every upcoming occurrence, so tell everyone already
// signed up for one. Weeks with their own override are skipped — that week's
// details come from the override, which this edit doesn't touch.
async function notifyUpcomingSignups(cls: {
  id: string; day: number; time: string; end_time: string | null;
  class_name: string; location: string | null; capacity: number;
}) {
  const db = supabaseAdmin();
  const { data: signups } = await db.from("signups").select("*")
    .eq("class_id", cls.id).gte("week_key", getWeekKey(new Date()));
  if (!signups?.length) return;

  const { data: overrides } = await db.from("overrides").select("week_key").eq("class_id", cls.id);
  const overridden = new Set((overrides ?? []).map((o) => o.week_key));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byWeek = new Map<string, typeof signups>();
  for (const s of signups) {
    if (overridden.has(s.week_key) || getSlotDate(cls.day, s.week_key) < today) continue;
    byWeek.set(s.week_key, [...(byWeek.get(s.week_key) ?? []), s]);
  }

  for (const [weekKey, rows] of byWeek) {
    await notifyStudentsClassUpdate({
      signups: rows,
      className: cls.class_name,
      classTime: fmtTimeRange(cls.time, cls.end_time),
      classDate: fmtDateLong(getSlotDate(cls.day, weekKey)),
      location: cls.location ?? "TBD",
      spotsLeft: cls.capacity - rows.length,
      capacity: cls.capacity,
    });
  }
}
