import { redirect } from "next/navigation";
import { getCurrentUserAndMembership } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";
import PendingActions from "@/components/PendingActions";

export default async function PendingPage() {
  const { user, membership } = await getCurrentUserAndMembership();

  if (!user) {
    redirect("/login");
  }
  if (!membership) {
    redirect("/join");
  }
  if (membership.status === "approved") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", membership.household_id)
    .single();

  const declined = membership.status === "declined";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">
        {declined ? "Request declined" : "Waiting for approval"}
      </h1>
      <p className="text-sm text-gray-500">
        {declined
          ? `Your request to join ${household?.name ?? "this household"} was declined.`
          : `Your request to join ${household?.name ?? "this household"} is pending. The household owner needs to approve you before you can see expenses.`}
      </p>
      <PendingActions declined={declined} />
    </main>
  );
}
