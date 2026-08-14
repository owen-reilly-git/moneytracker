"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseFrequency } from "@/lib/database.types";

export default function ExpenseForm({
  householdId,
  currentRoommateId,
}: {
  householdId: string;
  currentRoommateId: string;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<ExpenseFrequency>("one_time");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("expenses").insert({
      household_id: householdId,
      paid_by: currentRoommateId,
      label,
      amount: parsedAmount,
      frequency,
    });
    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setLabel("");
    setAmount("");
    setFrequency("one_time");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4"
    >
      <h2 className="font-medium">Add an expense</h2>

      <label className="flex flex-col gap-1 text-sm">
        Label
        <input
          required
          placeholder="e.g. electric"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Amount ($)
        <input
          required
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </label>

      <fieldset className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="frequency"
            checked={frequency === "one_time"}
            onChange={() => setFrequency("one_time")}
          />
          One-time
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="frequency"
            checked={frequency === "recurring"}
            onChange={() => setFrequency("recurring")}
          />
          Recurring (monthly)
        </label>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Adding…" : "Add expense"}
      </button>
    </form>
  );
}
