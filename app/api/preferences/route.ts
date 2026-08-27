import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/sms";

// Students manage their own preferences by email only, same as the rest of
// the app (signup/cancel are also email-only, no student auth).
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data } = await db.from("student_preferences").select("*").eq("email", email).maybeSingle();

  return NextResponse.json({
    email,
    phone: data?.phone ?? "",
    email_opt_in: data?.email_opt_in ?? true,
    sms_opt_in: data?.sms_opt_in ?? false,
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const email = body.email?.trim().toLowerCase();
  const emailOptIn = !!body.email_opt_in;
  const smsOptIn = !!body.sms_opt_in;
  const rawPhone = body.phone?.trim() ?? "";

  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizePhone(rawPhone);
    if (!phone) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  if (smsOptIn && !phone) {
    return NextResponse.json({ error: "phone_required_for_sms" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("student_preferences").upsert({
    email,
    phone,
    email_opt_in: emailOptIn,
    sms_opt_in: smsOptIn,
    updated_at: new Date().toISOString(),
  }, { onConflict: "email" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
