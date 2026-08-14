import { redirect } from "next/navigation";
import { getCurrentUserAndMembership } from "@/lib/membership";

export default async function Home() {
  const { user, membership } = await getCurrentUserAndMembership();

  if (!user) {
    redirect("/login");
  }

  if (!membership || membership.status === "declined") {
    redirect("/join");
  }

  if (membership.status === "pending") {
    redirect("/pending");
  }

  redirect("/dashboard");
}
