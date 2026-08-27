import nodemailer from "nodemailer";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://aop-weekly-schedule.vercel.app";

function manageUrlFor(email: string): string {
  return `${SITE_URL}/preferences?email=${encodeURIComponent(email)}`;
}

function getTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SENDER_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function brevoSend(
  to: string,
  _toName: string,
  subject: string,
  htmlContent: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await getTransport().sendMail({
      from: `AOP Shala NYC <${process.env.SENDER_EMAIL}>`,
      replyTo: process.env.ADMIN_EMAIL_1,
      to,
      subject,
      html: htmlContent,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function sendSignupEmails(params: {
  className: string;
  classTime: string;
  classDate: string;
  location: string;
  studentName: string;
  studentEmail: string;
  taken: number;
  capacity: number;
}) {
  const { studentEmailHtml, adminEmailHtml } = await import("./emailTemplates");
  const { notifyStudent } = await import("./notify");
  const { className, classTime, classDate, location, studentName, studentEmail, taken, capacity } = params;
  const spotsLeft = capacity - taken;

  const studentHtml = studentEmailHtml({ className, classTime, classDate, location, toName: studentName, action: "Signup", spotsLeft, capacity, manageUrl: manageUrlFor(studentEmail) });
  const adminHtml   = adminEmailHtml({ className, classTime, classDate, location, studentName, studentEmail, action: "New Signup", spotsTaken: taken, spotsLeft, capacity });

  const subject = `Signup Confirmation — ${className} · ${classDate}`;
  const adminSubject = `New Signup — ${studentName} · ${className} (${classDate})`;
  const smsBody = `AOP Shala: You're signed up for ${className} on ${classDate} at ${classTime}${location ? ` (${location})` : ""}.`;

  const [, admin1Result, admin2Result] = await Promise.all([
    notifyStudent({ email: studentEmail, name: studentName, subject, emailHtml: studentHtml, smsBody, pushTitle: "Signup Confirmed", pushUrl: "/" }),
    brevoSend(process.env.ADMIN_EMAIL_1!, "Admin", adminSubject, adminHtml),
    process.env.ADMIN_EMAIL_2
      ? brevoSend(process.env.ADMIN_EMAIL_2, "Admin", adminSubject, adminHtml)
      : Promise.resolve({ ok: true }),
  ]);
  console.log("[signup email] admin1:", admin1Result, "admin2:", admin2Result);
}

export async function notifyStudentsClassUpdate(params: {
  signups: { name: string; email: string }[];
  className: string;
  classTime: string;
  classDate: string;
  location: string;
  spotsLeft: number;
  capacity: number;
}) {
  const { studentEmailHtml } = await import("./emailTemplates");
  const { notifyStudent } = await import("./notify");
  const { className, classTime, classDate, location, spotsLeft, capacity } = params;
  const smsBody = `AOP Shala: ${className} on ${classDate} has been updated — now ${classTime}${location ? ` at ${location}` : ""}.`;
  for (const s of params.signups) {
    await notifyStudent({
      email: s.email, name: s.name,
      subject: `Class Update — ${className} · ${classDate}`,
      emailHtml: studentEmailHtml({ toName: s.name, action: "Class Update", subtext: "Your class details have been updated.", className, classTime, classDate, location, spotsLeft, capacity, manageUrl: manageUrlFor(s.email) }),
      smsBody,
      pushTitle: "Class Updated",
      pushUrl: "/",
    }).catch(console.error);
  }
}

export async function notifyStudentsClassCancelled(params: {
  signups: { name: string; email: string }[];
  className: string;
  classTime: string;
  classDate: string;
  location: string;
  capacity: number;
}) {
  const { studentEmailHtml } = await import("./emailTemplates");
  const { notifyStudent } = await import("./notify");
  const { className, classTime, classDate, location, capacity } = params;
  const smsBody = `AOP Shala: ${className} on ${classDate} at ${classTime} has been cancelled.`;
  for (const s of params.signups) {
    await notifyStudent({
      email: s.email, name: s.name,
      subject: `Class Cancelled — ${className} · ${classDate}`,
      emailHtml: studentEmailHtml({ toName: s.name, action: "Class Cancelled", subtext: "This class has been cancelled for this week.", className, classTime, classDate, location, spotsLeft: 0, capacity, manageUrl: manageUrlFor(s.email) }),
      smsBody,
      pushTitle: "Class Cancelled",
      pushUrl: "/",
    }).catch(console.error);
  }
}

export async function sendPackageExhaustedEmail(params: {
  studentName: string;
  studentEmail: string;
  totalClasses: number;
}) {
  const { packageExhaustedEmailHtml } = await import("./emailTemplates");
  const { studentName, studentEmail, totalClasses } = params;
  const subject = `⚠️ Package Exhausted — ${studentName}`;
  const html = packageExhaustedEmailHtml({ studentName, studentEmail, totalClasses });
  const [r1, r2] = await Promise.all([
    brevoSend(process.env.ADMIN_EMAIL_1!, "Admin", subject, html),
    process.env.ADMIN_EMAIL_2
      ? brevoSend(process.env.ADMIN_EMAIL_2, "Admin", subject, html)
      : Promise.resolve({ ok: true }),
  ]);
  console.log("[package exhausted email] admin1:", r1, "admin2:", r2);
}

export async function sendCancelEmails(params: {
  className: string;
  classTime: string;
  classDate: string;
  location: string;
  studentName: string;
  studentEmail: string;
  takenAfter: number;
  capacity: number;
}) {
  const { studentEmailHtml, adminEmailHtml } = await import("./emailTemplates");
  const { notifyStudent } = await import("./notify");
  const { className, classTime, classDate, location, studentName, studentEmail, takenAfter, capacity } = params;
  const spotsLeft = capacity - takenAfter;

  const studentHtml = studentEmailHtml({ className, classTime, classDate, location, toName: studentName, action: "Cancellation", spotsLeft, capacity, manageUrl: manageUrlFor(studentEmail) });
  const adminHtml   = adminEmailHtml({ className, classTime, classDate, location, studentName, studentEmail, action: "Cancelled", spotsTaken: takenAfter, spotsLeft, capacity });

  const subject = `Cancellation Confirmation — ${className} · ${classDate}`;
  const adminSubject = `Cancelled — ${studentName} · ${className} (${classDate})`;
  const smsBody = `AOP Shala: You've been removed from ${className} on ${classDate} at ${classTime}.`;

  await Promise.all([
    notifyStudent({ email: studentEmail, name: studentName, subject, emailHtml: studentHtml, smsBody, pushTitle: "Cancellation Confirmed", pushUrl: "/" }),
    brevoSend(process.env.ADMIN_EMAIL_1!, "Admin", adminSubject, adminHtml),
    process.env.ADMIN_EMAIL_2
      ? brevoSend(process.env.ADMIN_EMAIL_2, "Admin", adminSubject, adminHtml)
      : Promise.resolve(),
  ]);
}
