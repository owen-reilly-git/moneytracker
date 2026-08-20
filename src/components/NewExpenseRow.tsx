"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseFrequency } from "@/lib/database.types";

export default function NewExpenseRow({
  householdId,
  currentRoommateId,
  onDone,
}: {
  householdId: string;
  currentRoommateId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<ExpenseFrequency>("one_time");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    // Creates the expense and seeds one expense_participants row per
    // current household member in a single transaction (see
    // create_expense_with_participants in supabase/schema.sql) — avoids
    // ever having an expense with no participant rows.
    const { error: rpcError } = await supabase.rpc("create_expense_with_participants", {
      p_household_id: householdId,
      p_paid_by: currentRoommateId,
      p_label: label,
      p_amount: parsedAmount,
      p_frequency: frequency,
    });
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.refresh();
    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 border-b border-gray-100 py-3 text-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          required
          placeholder="e.g. electric"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 sm:py-1"
        />
        <input
          required
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 sm:w-28 sm:py-1"
        />
      </div>
      <fieldset className="flex gap-4">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="new-expense-frequency"
            checked={frequency === "one_time"}
            onChange={() => setFrequency("one_time")}
          />
          One-time
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="new-expense-frequency"
            checked={frequency === "recurring"}
            onChange={() => setFrequency("recurring")}
          />
          Recurring
        </label>
      </fieldset>
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-gray-900 px-3 py-1 text-white disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-gray-300 px-3 py-1"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
