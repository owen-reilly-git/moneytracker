import { redirect } from "next/navigation";
import { getCurrentUserAndMembership } from "@/lib/membership";
import CreateHouseholdForm from "@/components/CreateHouseholdForm";
import JoinHouseholdForm from "@/components/JoinHouseholdForm";

export default async function JoinPage() {
  const { user, membership } = await getCurrentUserAndMembership();

  if (!user) {
    redirect("/login");
  }
  if (membership?.status === "approved") {
    redirect("/dashboard");
  }
  if (membership?.status === "pending") {
    redirect("/pending");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Join or create a household</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every household has a home code. Create one if you&apos;re the first
          person moving in, or enter an existing code to request to join.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <CreateHouseholdForm userEmail={user.email ?? ""} />
        <JoinHouseholdForm userEmail={user.email ?? ""} />
      </div>
    </main>
  );
}
