"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateHouseholdForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [householdName, setHouseholdName] = useState("");
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

    const { data: household, error: householdError } = await supabase
      .from("households")
      .insert({ name: householdName, home_code: homeCode, owner_id: user.id })
      .select()
      .single();

    if (householdError || !household) {
      setLoading(false);
      setError(
        householdError?.code === "23505"
          ? "That home code is already taken. Pick another."
          : householdError?.message ?? "Could not create household.",
      );
      return;
    }

    const { error: roommateError } = await supabase.from("roommates").insert({
      household_id: household.id,
      user_id: user.id,
      name: yourName,
      email: userEmail,
      status: "approved",
    });

    setLoading(false);

    if (roommateError) {
      setError(roommateError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4"
    >
      <h2 className="font-medium">Create a household</h2>
      <p className="text-xs text-gray-500">
        You&apos;ll be the owner and can approve or decline join requests.
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
        Household name
        <input
          required
          placeholder="e.g. 42 Elm St"
          value={householdName}
          onChange={(e) => setHouseholdName(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Home code
        <input
          required
          placeholder="Make one up, e.g. ELM42"
          value={homeCode}
          onChange={(e) => setHomeCode(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create household"}
      </button>
    </form>
  );
}
