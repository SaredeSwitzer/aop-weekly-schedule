import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const [{ data, error }, { data: blockedRows }] = await Promise.all([
    db.from("signups").select("name, email, signed_up_at").order("signed_up_at", { ascending: false }),
    db.from("blocked_emails").select("email"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const blockedEmails = new Set((blockedRows ?? []).map((b) => b.email.toLowerCase()));

  // Deduplicate by email, keeping most recent name + counting signups
  const seen = new Map<string, { name: string; count: number }>();
  for (const row of data ?? []) {
    const key = row.email.toLowerCase();
    if (!seen.has(key)) seen.set(key, { name: row.name, count: 1 });
    else seen.get(key)!.count++;
  }

  const students = Array.from(seen.entries()).map(([email, { name, count }]) => ({
    email,
    name,
    signup_count: count,
    blocked: blockedEmails.has(email),
  }));
  return NextResponse.json(students);
}
