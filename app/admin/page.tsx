import { supabase } from "@/lib/supabase";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  const { data } = await supabase.from("classes").select("*").order("day").order("time");
  return <AdminPanel initialClasses={data ?? []} />;
}
