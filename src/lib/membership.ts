import { createClient } from "@/lib/supabase/server";
import type { Roommate } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";

export async function getCurrentUserAndMembership(): Promise<{
  user: User | null;
  membership: Roommate | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, membership: null };
  }

  const { data: rows } = await supabase
    .from("roommates")
    .select("*")
    .eq("user_id", user.id);

  const membership =
    rows?.find((r) => r.status === "approved") ??
    rows?.find((r) => r.status === "pending") ??
    rows?.[0] ??
    null;

  return { user, membership };
}
