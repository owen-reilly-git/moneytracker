"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseFrequency } from "@/lib/database.types";

export default function ExpenseForm({
  householdId,
  currentRoommateId,
  onSuccess,
}: {
  householdId: string;
  currentRoommateId: string;
  onSuccess?: () => void;
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
    // Creates the expense and seeds one expense_participants row per
    // currently-approved roommate in a single transaction (see
    // create_expense_with_participants in supabase/schema.sql) — avoids
    // ever having an expense with no participant rows.
    const { error: rpcError } = await supabase.rpc("create_expense_with_participants", {
      p_household_id: householdId,
      p_paid_by: currentRoommateId,
      p_label: label,
      p_amount: parsedAmount,
      p_frequency: frequency,
    });
    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setLabel("");
    setAmount("");
    setFrequency("one_time");
    router.refresh();
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
