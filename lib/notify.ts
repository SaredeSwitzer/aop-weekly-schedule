import { supabaseAdmin } from "./supabase";
import { brevoSend } from "./email";
import { sendSms } from "./sms";
import { notifyStudentPush } from "./push";

export type StudentPreferences = {
  email: string;
  phone: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
};

export async function getStudentPreferences(email: string): Promise<StudentPreferences> {
  const db = supabaseAdmin();
  const { data } = await db.from("student_preferences").select("*").eq("email", email.toLowerCase()).maybeSingle();
  return {
    email: email.toLowerCase(),
    phone: data?.phone ?? null,
    email_opt_in: data?.email_opt_in ?? true,
    sms_opt_in: data?.sms_opt_in ?? false,
  };
}

// Sends to a student's opted-in channels (email defaults on, SMS defaults off
// until they set a phone number and opt in via /preferences). Push has no
// separate opt-in flag — subscribing a device via the toggle on /preferences
// *is* the opt-in — so it's sent whenever the student has a subscribed device.
export async function notifyStudent(params: {
  email: string;
  name: string;
  subject: string;
  emailHtml: string;
  smsBody?: string;
  pushTitle?: string;
  pushBody?: string;
  pushUrl?: string;
}) {
  const prefs = await getStudentPreferences(params.email);
  const tasks: Promise<unknown>[] = [];

  if (prefs.email_opt_in) {
    tasks.push(brevoSend(params.email, params.name, params.subject, params.emailHtml));
  }
  if (prefs.sms_opt_in && prefs.phone && params.smsBody) {
    tasks.push(sendSms(prefs.phone, params.smsBody));
  }
  if (params.pushBody || params.smsBody) {
    tasks.push(notifyStudentPush(params.email, {
      title: params.pushTitle ?? "AOP Shala NYC",
      body: params.pushBody ?? params.smsBody!,
      url: params.pushUrl,
    }));
  }

  await Promise.all(tasks);
}
