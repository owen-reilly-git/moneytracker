import { redirect } from "next/navigation";
import { getCurrentUserAndMembership } from "@/lib/membership";

export default async function Home() {
  const { user, membership } = await getCurrentUserAndMembership();

  if (!user) {
    redirect("/login");
  }

  if (!membership) {
    redirect("/join");
  }

  redirect("/dashboard");
}
