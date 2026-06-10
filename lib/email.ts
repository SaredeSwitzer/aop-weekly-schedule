import nodemailer from "nodemailer";

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
  const { className, classTime, classDate, location, studentName, studentEmail, taken, capacity } = params;
  const spotsLeft = capacity - taken;

  const studentHtml = studentEmailHtml({ className, classTime, classDate, location, toName: studentName, action: "Signup", spotsLeft, capacity });
  const adminHtml   = adminEmailHtml({ className, classTime, classDate, location, studentName, studentEmail, action: "New Signup", spotsTaken: taken, spotsLeft, capacity });

  const subject = `Signup Confirmation — ${className} · ${classDate}`;
  const adminSubject = `New Signup — ${studentName} · ${className} (${classDate})`;

  const [studentResult, admin1Result, admin2Result] = await Promise.all([
    brevoSend(studentEmail, studentName, subject, studentHtml),
    brevoSend(process.env.ADMIN_EMAIL_1!, "Admin", adminSubject, adminHtml),
    process.env.ADMIN_EMAIL_2
      ? brevoSend(process.env.ADMIN_EMAIL_2, "Admin", adminSubject, adminHtml)
      : Promise.resolve({ ok: true }),
  ]);
  console.log("[signup email] student:", studentResult, "admin1:", admin1Result, "admin2:", admin2Result);
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
  const { className, classTime, classDate, location, spotsLeft, capacity } = params;
  for (const s of params.signups) {
    brevoSend(
      s.email, s.name,
      `Class Update — ${className} · ${classDate}`,
      studentEmailHtml({ toName: s.name, action: "Class Update", subtext: "Your class details have been updated.", className, classTime, classDate, location, spotsLeft, capacity }),
    ).catch(console.error);
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
  const { className, classTime, classDate, location, capacity } = params;
  for (const s of params.signups) {
    brevoSend(
      s.email, s.name,
      `Class Cancelled — ${className} · ${classDate}`,
      studentEmailHtml({ toName: s.name, action: "Class Cancelled", subtext: "This class has been cancelled for this week.", className, classTime, classDate, location, spotsLeft: 0, capacity }),
    ).catch(console.error);
  }
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
  const { className, classTime, classDate, location, studentName, studentEmail, takenAfter, capacity } = params;
  const spotsLeft = capacity - takenAfter;

  const studentHtml = studentEmailHtml({ className, classTime, classDate, location, toName: studentName, action: "Cancellation", spotsLeft, capacity });
  const adminHtml   = adminEmailHtml({ className, classTime, classDate, location, studentName, studentEmail, action: "Cancelled", spotsTaken: takenAfter, spotsLeft, capacity });

  const subject = `Cancellation Confirmation — ${className} · ${classDate}`;
  const adminSubject = `Cancelled — ${studentName} · ${className} (${classDate})`;

  await Promise.all([
    brevoSend(studentEmail, studentName, subject, studentHtml),
    brevoSend(process.env.ADMIN_EMAIL_1!, "Admin", adminSubject, adminHtml),
    process.env.ADMIN_EMAIL_2
      ? brevoSend(process.env.ADMIN_EMAIL_2, "Admin", adminSubject, adminHtml)
      : Promise.resolve(),
  ]);
}
