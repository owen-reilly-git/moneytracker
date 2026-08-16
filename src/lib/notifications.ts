import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * The only place a notification gets created. A future email
 * integration (e.g. a Supabase Edge Function triggered on insert into
 * `notifications`) should hook in here rather than each call site
 * sending mail itself.
 */
export async function notifyResplit(
  supabase: SupabaseClient<Database>,
  params: {
    householdId: string;
    recipientRoommateId: string;
    expenseId: string;
    message: string;
  },
) {
  await supabase.from("notifications").insert({
    household_id: params.householdId,
    recipient_roommate_id: params.recipientRoommateId,
    expense_id: params.expenseId,
    message: params.message,
  });
}
