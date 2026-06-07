import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";
import { brevoSend } from "@/lib/email";
import { broadcastEmailHtml, weeklyReminderHtml } from "@/lib/emailTemplates";
import { fmtDate, getWeekDates } from "@/lib/dates";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type } = body;
  const db = supabaseAdmin();

  if (type === "broadcast") {
    const { subject, message } = body;
    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "subject and message required" }, { status: 400 });
    }

    const { data: signups } = await db
      .from("signups")
      .select("name, email, signed_up_at")
      .order("signed_up_at", { ascending: false });

    const seen = new Map<string, string>();
    for (const s of signups ?? []) {
      if (!seen.has(s.email.toLowerCase())) seen.set(s.email.toLowerCase(), s.name);
    }
    const students = Array.from(seen.entries()).map(([email, name]) => ({ email, name }));

    let sent = 0, failed = 0;
    for (const s of students) {
      const result = await brevoSend(s.email, s.name, subject, broadcastEmailHtml(s.name, message));
      if (result.ok) sent++; else failed++;
    }
    return NextResponse.json({ sent, failed });
  }

  if (type === "reminder") {
    const { week_key } = body;
    if (!week_key) return NextResponse.json({ error: "week_key required" }, { status: 400 });

    const { data: signups } = await db
      .from("signups")
      .select("name, email, signed_up_at")
      .order("signed_up_at", { ascending: false });

    const seen = new Map<string, string>();
    for (const s of signups ?? []) {
      if (!seen.has(s.email.toLowerCase())) seen.set(s.email.toLowerCase(), s.name);
    }
    const students = Array.from(seen.entries()).map(([email, name]) => ({ email, name }));

    const dates = getWeekDates(week_key);
    const weekOf = `${fmtDate(dates[0])} – ${fmtDate(dates[6])}`;
    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    const scheduleUrl = `${origin}/`;

    let sent = 0, failed = 0;
    for (const s of students) {
      const result = await brevoSend(s.email, s.name, `Weekly Schedule — Week of ${weekOf}`, weeklyReminderHtml(s.name, weekOf, scheduleUrl));
      if (result.ok) sent++; else failed++;
    }
    return NextResponse.json({ sent, failed });
  }

  return NextResponse.json({ error: "Unknown broadcast type" }, { status: 400 });
}
