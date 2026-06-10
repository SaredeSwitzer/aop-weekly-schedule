import { supabaseAdmin } from "@/lib/supabase";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const db = supabaseAdmin();
  const { data } = await db.from("classes").select("*").order("day").order("time");
  return <AdminPanel initialClasses={data ?? []} />;
}
