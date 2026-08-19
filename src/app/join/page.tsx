import { redirect } from "next/navigation";
import { getCurrentUserAndMembership } from "@/lib/membership";
import JoinOrCreateRoomForm from "@/components/JoinOrCreateRoomForm";

export default async function JoinPage() {
  const { user, membership } = await getCurrentUserAndMembership();

  if (!user) {
    redirect("/login");
  }
  if (membership) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Join or create a room</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every household is a room with a name and a password.
        </p>
      </div>

      <JoinOrCreateRoomForm />
    </main>
  );
}
