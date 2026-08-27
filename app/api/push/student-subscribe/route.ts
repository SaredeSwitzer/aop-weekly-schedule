import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

// Students manage push subscriptions by email only, same no-auth model as
// the rest of the app (signup/cancel/preferences are also email-only).
export async function POST(req: NextRequest) {
  const { email, endpoint, keys } = await req.json();
  if (!email?.trim() || !isValidEmail(email.trim())) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("student_push_subscriptions").upsert(
    { email: email.trim().toLowerCase(), endpoint, p256dh: keys.p256dh, auth: keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from("student_push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
