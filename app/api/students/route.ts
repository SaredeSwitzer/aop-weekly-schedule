import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("signups")
    .select("name, email, signed_up_at")
    .order("signed_up_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deduplicate by email, keeping the most recent name
  const seen = new Map<string, string>();
  for (const row of data ?? []) {
    const key = row.email.toLowerCase();
    if (!seen.has(key)) seen.set(key, row.name);
  }

  const students = Array.from(seen.entries()).map(([email, name]) => ({ email, name }));
  return NextResponse.json(students);
}
