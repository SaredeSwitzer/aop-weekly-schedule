import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function sendPushToAdmins(payload: { title: string; body: string; url?: string }) {
  const db = supabaseAdmin();
  const { data: subs } = await db.from("push_subscriptions").select("*");
  if (!subs?.length) return;

  const json = JSON.stringify(payload);
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json,
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
