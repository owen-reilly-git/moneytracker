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
  if (membership.status === "pending" || membership.status === "declined") {
    redirect("/pending");
  }

  const supabase = await createClient();

  const [{ data: household }, { data: roommates }, { data: expenses }] =
    await Promise.all([
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
      currentRoommateId={membership.id}
      isOwner={household.owner_id === user.id}
    />
  );
}
