import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// Records a notification (shown in the admin panel's inbox until dismissed)
// and pushes it to every admin device, including the current unread count
// so each device's app-icon badge stays in sync without a round trip.
export async function notifyAdmins(notification: { type: "signup" | "cancel"; title: string; body: string; url?: string }) {
  const db = supabaseAdmin();

  const { data: inserted } = await db.from("admin_notifications")
    .insert({ type: notification.type, title: notification.title, body: notification.body, url: notification.url ?? "/admin" })
    .select().single();

  const { count } = await db.from("admin_notifications").select("*", { count: "exact", head: true });

  const { data: subs } = await db.from("push_subscriptions").select("*");
  if (!subs?.length) return;

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url ?? "/admin",
    notificationId: inserted?.id,
    badgeCount: count ?? 0,
  });
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) staleIds.push(sub.id);
        else console.error("push send failed", e);
      }
    }),
  );

  if (staleIds.length) {
    await db.from("push_subscriptions").delete().in("id", staleIds);
  }
}

// Pushes to every device a student has subscribed on (there's no separate
// "opt in" flag — subscribing a device *is* the opt-in, same as admin push).
export async function notifyStudentPush(email: string, notification: { title: string; body: string; url?: string }) {
  const db = supabaseAdmin();

  const { data: subs } = await db.from("student_push_subscriptions").select("*").eq("email", email.toLowerCase());
  if (!subs?.length) return;

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url ?? "/",
  });
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) staleIds.push(sub.id);
        else console.error("student push send failed", e);
      }
    }),
  );

  if (staleIds.length) {
    await db.from("student_push_subscriptions").delete().in("id", staleIds);
  }
}
