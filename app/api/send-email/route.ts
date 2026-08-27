import { NextRequest, NextResponse } from "next/server";
import { notifyStudent } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const { to, toName, subject, htmlContent, smsBody } = await req.json();
  if (!to || !subject || !htmlContent) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  await notifyStudent({ email: to, name: toName ?? "", subject, emailHtml: htmlContent, smsBody });
  return NextResponse.json({ success: true });
}
