// HTML-escape user-supplied values to prevent XSS in email clients
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BASE_STYLE = `body{font-family:Georgia,serif;background:#faf7f2;margin:0;padding:0;}.wrap{max-width:520px;margin:30px auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);}.header{background:linear-gradient(135deg,#3d2e1e,#6b4c30);padding:28px 32px;color:white;}.header h1{font-size:20px;margin:0 0 4px;}.header p{margin:0;font-size:13px;opacity:0.7;font-family:sans-serif;}.body{padding:28px 32px;}.section-title{font-family:sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#9a7d5e;margin:0 0 10px;}.card{background:#faf7f2;border-radius:10px;padding:16px 20px;margin-bottom:16px;}.row{padding:6px 0;border-bottom:1px solid #ede5dc;font-family:sans-serif;font-size:14px;}.row:last-child{border-bottom:none;}.row-label{color:#999;font-size:12px;}.row-value{color:#3d2e1e;font-weight:500;}.footer{background:#f5ece0;padding:16px 32px;text-align:center;font-family:sans-serif;font-size:12px;color:#9a7d5e;}`;

type StudentParams = {
  toName: string;
  action: string;
  className: string;
  classDate: string;
  classTime: string;
  location: string;
  spotsLeft: number;
  capacity: number;
};

export function studentEmailHtml(p: StudentParams): string {
  return `<!DOCTYPE html><html><head><meta charset='UTF-8'/><style>${BASE_STYLE}.greeting{font-size:17px;color:#3d2e1e;margin:0 0 6px;}.subtext{font-family:sans-serif;font-size:14px;color:#9a7d5e;margin:0 0 24px;}.cancel-note{font-family:sans-serif;font-size:13px;color:#aaa;line-height:1.6;margin-bottom:20px;}.signoff{font-family:Georgia,serif;font-size:15px;color:#3d2e1e;}</style></head><body><div class='wrap'><div class='header'><h1>🧘 AOP Shala NYC</h1><p>Class Confirmation</p></div><div class='body'><p class='greeting'>Hi ${esc(p.toName)},</p><p class='subtext'>${esc(p.action)} confirmed! Here are your class details.</p><p class='section-title'>Your Class</p><div class='card'><div class='row'><div class='row-label'>Class</div><div class='row-value'>${esc(p.className)}</div></div><div class='row'><div class='row-label'>Date</div><div class='row-value'>${esc(p.classDate)}</div></div><div class='row'><div class='row-label'>Time</div><div class='row-value'>${esc(p.classTime)}</div></div><div class='row'><div class='row-label'>Location</div><div class='row-value'>📍 ${esc(p.location)}</div></div><div class='row'><div class='row-label'>Spots remaining</div><div class='row-value'>${p.spotsLeft} of ${p.capacity}</div></div></div><p class='cancel-note'>Need to cancel? Visit the schedule, click on your class and select <strong>Cancel My Signup</strong>.</p><p class='signoff'>See you on the mat! 🧘</p></div><div class='footer'>AOP Shala NYC · intouchyoga@icloud.com</div></div></body></html>`;
}

type AdminParams = {
  action: string;
  studentName: string;
  studentEmail: string;
  className: string;
  classDate: string;
  classTime: string;
  location: string;
  spotsTaken: number;
  spotsLeft: number;
  capacity: number;
};

export function adminEmailHtml(p: AdminParams): string {
  return `<!DOCTYPE html><html><head><meta charset='UTF-8'/><style>${BASE_STYLE}.action-badge{display:inline-block;background:#f5ece0;color:#7a5a30;font-family:sans-serif;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;}</style></head><body><div class='wrap'><div class='header'><h1>🧘 AOP Shala NYC</h1><p>Class Notification</p></div><div class='body'><div class='action-badge'>${esc(p.action)}</div><p class='section-title'>Student</p><div class='card'><div class='row'><div class='row-label'>Name</div><div class='row-value'>${esc(p.studentName)}</div></div><div class='row'><div class='row-label'>Email</div><div class='row-value'>${esc(p.studentEmail)}</div></div></div><p class='section-title'>Class Details</p><div class='card'><div class='row'><div class='row-label'>Class</div><div class='row-value'>${esc(p.className)}</div></div><div class='row'><div class='row-label'>Date</div><div class='row-value'>${esc(p.classDate)}</div></div><div class='row'><div class='row-label'>Time</div><div class='row-value'>${esc(p.classTime)}</div></div><div class='row'><div class='row-label'>Location</div><div class='row-value'>📍 ${esc(p.location)}</div></div></div><p class='section-title'>Enrollment</p><div class='card'><div class='row'><div class='row-label'>Spots filled</div><div class='row-value'>${p.spotsTaken} of ${p.capacity}</div></div><div class='row'><div class='row-label'>Spots remaining</div><div class='row-value'>${p.spotsLeft}</div></div></div></div><div class='footer'>AOP Shala NYC · intouchyoga@icloud.com</div></div></body></html>`;
}

export function broadcastEmailHtml(toName: string, messageBody: string): string {
  const safe = esc(messageBody).replace(/\n/g, "<br/>");
  return `<!DOCTYPE html><html><head><meta charset='UTF-8'/><style>${BASE_STYLE}.greeting{font-size:17px;color:#3d2e1e;margin:0 0 20px;}.message{font-family:sans-serif;font-size:14px;color:#5a3e28;line-height:1.8;}</style></head><body><div class='wrap'><div class='header'><h1>🧘 AOP Shala NYC</h1><p>Message from your teacher</p></div><div class='body'><p class='greeting'>Hi ${esc(toName) || "there"},</p><div class='message'>${safe}</div></div><div class='footer'>AOP Shala NYC · intouchyoga@icloud.com</div></div></body></html>`;
}

export function weeklyReminderHtml(toName: string, weekOf: string, scheduleUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset='UTF-8'/><style>${BASE_STYLE}.greeting{font-size:17px;color:#3d2e1e;margin:0 0 16px;}.message{font-family:sans-serif;font-size:14px;color:#5a3e28;line-height:1.8;margin-bottom:24px;}.cta{display:block;background:linear-gradient(135deg,#3d2e1e,#6b4c30);color:white;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-family:sans-serif;font-weight:600;font-size:14px;margin-bottom:24px;}.signoff{font-family:Georgia,serif;font-size:15px;color:#3d2e1e;line-height:1.7;}</style></head><body><div class='wrap'><div class='header'><h1>🧘 AOP Shala NYC</h1><p>Weekly Schedule</p></div><div class='body'><p class='greeting'>Hi ${esc(toName) || "there"},</p><p class='message'>The schedule for the week of <strong>${esc(weekOf)}</strong> is now live! Reserve your spot before classes fill up.</p><a href='${scheduleUrl}' class='cta'>View Schedule &amp; Sign Up →</a><p class='signoff'>See you on the mat! 🧘<br/>— AOP Shala NYC</p></div><div class='footer'>AOP Shala NYC · intouchyoga@icloud.com</div></div></body></html>`;
}
