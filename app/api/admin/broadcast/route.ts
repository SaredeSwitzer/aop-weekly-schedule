import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";
import { notifyStudent } from "@/lib/notify";
import { broadcastEmailHtml, weeklyReminderHtml } from "@/lib/emailTemplates";
import { fmtDate, getWeekDates } from "@/lib/dates";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://aop-weekly-schedule.vercel.app";
function manageUrlFor(email: string): string {
  return `${SITE_URL}/preferences?email=${encodeURIComponent(email)}`;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type } = body;
  const db = supabaseAdmin();

  const { data: blockedRows } = await db.from("blocked_emails").select("email");
  const blockedEmails = new Set((blockedRows ?? []).map((b) => b.email.toLowerCase()));

  if (type === "broadcast") {
    const { subject, message } = body;
    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "subject and message required" }, { status: 400 });
    }

    const { data: signups } = await db
      .from("signups")
      .select("name, email, signed_up_at")
      .order("signed_up_at", { ascending: false })
      .limit(5000);

    const seen = new Map<string, string>();
    for (const s of signups ?? []) {
      if (!seen.has(s.email.toLowerCase())) seen.set(s.email.toLowerCase(), s.name);
    }
    const students = Array.from(seen.entries())
      .filter(([email]) => !blockedEmails.has(email))
      .map(([email, name]) => ({ email, name }));

    const smsBody = `AOP Shala: ${message}`.slice(0, 300);
    let sent = 0, failed = 0;
    for (const s of students) {
      await notifyStudent({
        email: s.email, name: s.name, subject,
        emailHtml: broadcastEmailHtml(s.name, message, manageUrlFor(s.email)),
        smsBody,
        pushTitle: subject,
        pushBody: message,
        pushUrl: "/",
      }).then(() => sent++).catch(() => failed++);
    }
    return NextResponse.json({ sent, failed });
  }

  if (type === "reminder") {
    const { week_key } = body;
    if (!week_key) return NextResponse.json({ error: "week_key required" }, { status: 400 });

    const { data: signups } = await db
      .from("signups")
      .select("name, email, signed_up_at")
      .order("signed_up_at", { ascending: false })
      .limit(5000);

    const seen = new Map<string, string>();
    for (const s of signups ?? []) {
      if (!seen.has(s.email.toLowerCase())) seen.set(s.email.toLowerCase(), s.name);
    }
    const students = Array.from(seen.entries())
      .filter(([email]) => !blockedEmails.has(email))
      .map(([email, name]) => ({ email, name }));

    const dates = getWeekDates(week_key);
    const weekOf = `${fmtDate(dates[0])} – ${fmtDate(dates[6])}`;
    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    const scheduleUrl = `${origin}/`;

    const smsBody = `AOP Shala: The schedule for the week of ${weekOf} is live — ${scheduleUrl}`;
    let sent = 0, failed = 0;
    for (const s of students) {
      await notifyStudent({
        email: s.email, name: s.name,
        subject: `Weekly Schedule — Week of ${weekOf}`,
        emailHtml: weeklyReminderHtml(s.name, weekOf, scheduleUrl),
        smsBody,
        pushTitle: "Weekly Schedule",
        pushBody: `The schedule for the week of ${weekOf} is live.`,
        pushUrl: "/",
      }).then(() => sent++).catch(() => failed++);
    }
    return NextResponse.json({ sent, failed });
  }

  return NextResponse.json({ error: "Unknown broadcast type" }, { status: 400 });
}
