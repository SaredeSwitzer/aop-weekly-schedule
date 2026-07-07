import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  return supabaseAdmin();
}

export async function GET(req: NextRequest) {
  const db = await requireAdmin();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  const query = db.from("packages").select("*").order("student_name");
  const { data, error } = email
    ? await query.eq("student_email", email.toLowerCase())
    : await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const db = await requireAdmin();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { student_email, student_name, total_classes, used_classes, notes } = await req.json();
  if (!student_email || !student_name || !total_classes) {
    return NextResponse.json({ error: "student_email, student_name, and total_classes required" }, { status: 400 });
  }

  const { data, error } = await db
    .from("packages")
    .insert({
      student_email: student_email.toLowerCase(),
      student_name,
      total_classes,
      used_classes: used_classes ?? 0,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const db = await requireAdmin();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, total_classes, used_classes, notes, student_name } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (total_classes !== undefined) updates.total_classes = total_classes;
  if (used_classes  !== undefined) updates.used_classes  = Math.max(0, used_classes);
  if (notes         !== undefined) updates.notes         = notes;
  if (student_name  !== undefined) updates.student_name  = student_name;

  const { data, error } = await db.from("packages").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const db = await requireAdmin();
  if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await db.from("packages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
