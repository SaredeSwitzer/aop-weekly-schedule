import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase";
import { fmtTimeRange, fmtDateLong, getSlotDate } from "@/lib/dates";
import { sendSignupEmails, sendCancelEmails } from "@/lib/email";

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get("week");
  if (!week) return NextResponse.json({ error: "week param required" }, { status: 400 });

  const { data, error } = await supabase.from("signups").select("*").eq("week_key", week);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { week_key, class_id, name, email } = await req.json();
  if (!week_key || !class_id || !name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Fetch the class
  const { data: cls } = await db.from("classes").select("*").eq("id", class_id).single();
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  // Check for override (cancelled or capacity change)
  const { data: ov } = await db.from("overrides")
    .select("*").eq("week_key", week_key).eq("class_id", class_id).maybeSingle();
  if (ov?.cancelled) return NextResponse.json({ error: "This class is cancelled this week" }, { status: 400 });
  const capacity = ov?.capacity ?? cls.capacity;

  // Current signups for this slot
  const { data: existing } = await db.from("signups")
    .select("*").eq("week_key", week_key).eq("class_id", class_id);
  const taken = existing?.length ?? 0;

  if (existing?.some((s) => s.email.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: "already_signed_up" }, { status: 409 });
  }
  if (taken >= capacity) {
    return NextResponse.json({ error: "Class is full" }, { status: 409 });
  }

  // Insert signup
  const { data: signup, error: insertErr } = await db.from("signups")
    .insert({ week_key, class_id, name: name.trim(), email: email.trim().toLowerCase() })
    .select().single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  const slotDate = getSlotDate(cls.day, week_key);
  await sendSignupEmails({
    className: ov?.class_name ?? cls.class_name,
    classTime: fmtTimeRange(ov?.time ?? cls.time, ov?.end_time ?? cls.end_time),
    classDate: fmtDateLong(slotDate),
    location:  ov?.location ?? cls.location ?? "TBD",
    studentName:  name.trim(),
    studentEmail: email.trim().toLowerCase(),
    taken: taken + 1,
    capacity,
  }).catch(console.error);

  return NextResponse.json(signup, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Admin removal by signup UUID (no email notification)
  const signupId = searchParams.get("id");
  if (signupId) {
    const { userId } = await (await import("@clerk/nextjs/server")).auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const db = supabaseAdmin();
    const { error } = await db.from("signups").delete().eq("id", signupId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const week_key  = searchParams.get("week_key");
  const class_id  = searchParams.get("class_id");
  const email     = searchParams.get("email");

  if (!week_key || !class_id || !email) {
    return NextResponse.json({ error: "week_key, class_id, email required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Find the signup
  const { data: signups } = await db.from("signups")
    .select("*").eq("week_key", week_key).eq("class_id", class_id);
  const signup = signups?.find((s) => s.email.toLowerCase() === email.toLowerCase());
  if (!signup) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Fetch class + override for email params
  const [{ data: cls }, { data: ov }] = await Promise.all([
    db.from("classes").select("*").eq("id", class_id).single(),
    db.from("overrides").select("*").eq("week_key", week_key).eq("class_id", class_id).maybeSingle(),
  ]);
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const capacity   = ov?.capacity ?? cls.capacity;
  const takenAfter = Math.max(0, (signups?.length ?? 1) - 1);

  // Send cancel emails before deleting
  const slotDate = getSlotDate(cls.day, week_key);
  await sendCancelEmails({
    className: ov?.class_name ?? cls.class_name,
    classTime: fmtTimeRange(ov?.time ?? cls.time, ov?.end_time ?? cls.end_time),
    classDate: fmtDateLong(slotDate),
    location:  ov?.location ?? cls.location ?? "TBD",
    studentName:  signup.name,
    studentEmail: signup.email,
    takenAfter,
    capacity,
  }).catch(console.error);

  // Delete signup
  const { error: delErr } = await db.from("signups").delete().eq("id", signup.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
