import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";
import { fmtTimeRange, fmtDateLong, getSlotDate } from "@/lib/dates";
import { notifyStudentsClassUpdate, notifyStudentsClassCancelled } from "@/lib/email";

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get("week");
  if (!week) return NextResponse.json({ error: "week param required" }, { status: 400 });

  const { data, error } = await supabase
    .from("overrides")
    .select("*")
    .eq("week_key", week);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { week_key, class_id, cancelled, time, end_time, class_name, location, capacity } = body;
  if (!week_key || !class_id) {
    return NextResponse.json({ error: "week_key and class_id required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Fetch base class for notification context
  const { data: cls } = await db.from("classes").select("*").eq("id", class_id).single();
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  // Upsert the override
  const overrideData = {
    week_key,
    class_id,
    cancelled: cancelled ?? false,
    time: time ?? null,
    end_time: end_time ?? null,
    class_name: class_name ?? null,
    location: location !== undefined ? location : null,
    capacity: capacity ?? null,
  };

  const { data: ov, error } = await db
    .from("overrides")
    .upsert(overrideData, { onConflict: "week_key,class_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch signups and notify students (fire-and-forget)
  const { data: signupRows } = await db
    .from("signups")
    .select("*")
    .eq("week_key", week_key)
    .eq("class_id", class_id);

  if (signupRows?.length) {
    const effectiveName    = class_name ?? cls.class_name;
    const effectiveTime    = fmtTimeRange(time ?? cls.time, end_time ?? cls.end_time);
    const effectiveLocation = (location !== undefined ? location : cls.location) ?? "TBD";
    const effectiveCapacity = capacity ?? cls.capacity;
    const slotDate = getSlotDate(cls.day, week_key);
    const classDate = fmtDateLong(slotDate);

    if (cancelled) {
      notifyStudentsClassCancelled({
        signups: signupRows,
        className: effectiveName,
        classTime: effectiveTime,
        classDate,
        location: effectiveLocation,
        capacity: effectiveCapacity,
      }).catch(console.error);
    } else {
      notifyStudentsClassUpdate({
        signups: signupRows,
        className: effectiveName,
        classTime: effectiveTime,
        classDate,
        location: effectiveLocation,
        spotsLeft: effectiveCapacity - signupRows.length,
        capacity: effectiveCapacity,
      }).catch(console.error);
    }
  }

  return NextResponse.json(ov);
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const week_key = searchParams.get("week_key");
  const class_id = searchParams.get("class_id");
  if (!week_key || !class_id) {
    return NextResponse.json({ error: "week_key and class_id required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from("overrides")
    .delete()
    .eq("week_key", week_key)
    .eq("class_id", class_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
