import { NextRequest, NextResponse } from "next/server";
import { brevoSend } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { to, toName, subject, htmlContent } = await req.json();
  if (!to || !subject || !htmlContent) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const result = await brevoSend(to, toName ?? "", subject, htmlContent);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
