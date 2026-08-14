"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinHouseholdForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [homeCode, setHomeCode] = useState("");
  const [yourName, setYourName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setError("You must be signed in.");
      return;
    }

    const { data: matches, error: lookupError } = await supabase.rpc(
      "find_household_by_code",
      { code: homeCode },
    );

    if (lookupError || !matches || matches.length === 0) {
      setLoading(false);
      setError("No household found with that code.");
      return;
    }

    const household = matches[0];

    const { error: roommateError } = await supabase.from("roommates").insert({
      household_id: household.id,
      user_id: user.id,
      name: yourName,
      email: userEmail,
      status: "pending",
    });

    setLoading(false);

    if (roommateError) {
      setError(
        roommateError.code === "23505"
          ? "You've already requested to join this household."
          : roommateError.message,
      );
      return;
    }

    router.push("/pending");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4"
    >
      <h2 className="font-medium">Join with a home code</h2>
      <p className="text-xs text-gray-500">
        The household owner will need to approve your request.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input
          required
          value={yourName}
          onChange={(e) => setYourName(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Home code
        <input
          required
          value={homeCode}
          onChange={(e) => setHomeCode(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md border border-gray-900 px-3 py-2 text-sm font-medium text-gray-900 disabled:opacity-50"
      >
        {loading ? "Requesting…" : "Request to join"}
      </button>
    </form>
  );
}
