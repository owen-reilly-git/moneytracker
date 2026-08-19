import { redirect } from "next/navigation";
import { getCurrentUserAndMembership } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const { user, membership } = await getCurrentUserAndMembership();

  if (!user) {
    redirect("/login");
  }
  if (!membership) {
    redirect("/join");
  }

  const supabase = await createClient();

  const [
    { data: household },
    { data: roommates },
    { data: expenses },
    { data: notifications },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from("households")
      .select("*")
      .eq("id", membership.household_id)
      .single(),
    supabase
      .from("roommates")
      .select("*")
      .eq("household_id", membership.household_id)
      .order("name"),
    supabase
      .from("expenses")
      .select("*, expense_participants(roommate_id, opted_out)")
      .eq("household_id", membership.household_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("*")
      .eq("recipient_roommate_id", membership.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("payments")
      .select("*")
      .eq("household_id", membership.household_id)
      .order("created_at", { ascending: false }),
  ]);

  if (!household) {
    redirect("/join");
  }

  return (
    <DashboardClient
      household={household}
      roommates={roommates ?? []}
      expenses={expenses ?? []}
      notifications={notifications ?? []}
      payments={payments ?? []}
      currentRoommateId={membership.id}
    />
  );
}
