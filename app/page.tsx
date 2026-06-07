import { supabase } from "@/lib/supabase";
import type { Class } from "@/lib/types";
import SchedulePage from "@/components/SchedulePage";

export const revalidate = 60;

export default async function Page() {
  const { data } = await supabase
    .from("classes")
    .select("*")
    .order("day")
    .order("time");

  const classes: Class[] = data ?? [];

  return <SchedulePage initialClasses={classes} />;
}
