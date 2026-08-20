"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notifyResplit } from "@/lib/notifications";
import type { Roommate, ExpenseWithParticipants, ExpenseFrequency } from "@/lib/database.types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function ExpenseRow({
  expense,
  roommates,
  currentRoommateId,
  householdId,
}: {
  expense: ExpenseWithParticipants;
  roommates: Roommate[];
  currentRoommateId: string;
  householdId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(expense.label);
  const [amount, setAmount] = useState(String(expense.amount));
  const [frequency, setFrequency] = useState<ExpenseFrequency>(expense.frequency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roommateNameById = new Map(roommates.map((r) => [r.id, r.name]));
  const payerName = roommateNameById.get(expense.paid_by) ?? "—";
  const isPayer = expense.paid_by === currentRoommateId;

  const myParticipation = expense.expense_participants.find(
    (p) => p.roommate_id === currentRoommateId,
  );
  const activeParticipants = expense.expense_participants.filter((p) => !p.opted_out);
  const participantNames = activeParticipants
    .map((p) => roommateNameById.get(p.roommate_id) ?? "—")
    .join(", ");
  const optedOutCount = expense.expense_participants.length - activeParticipants.length;

  async function toggleOptOut() {
    if (!myParticipation || isPayer) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const nextOptedOut = !myParticipation.opted_out;

    const { error: updateError } = await supabase
      .from("expense_participants")
      .update({ opted_out: nextOptedOut })
      .eq("expense_id", expense.id)
      .eq("roommate_id", currentRoommateId);

    if (updateError) {
      setBusy(false);
      setError(updateError.message);
      return;
    }

    const actorName = roommateNameById.get(currentRoommateId) ?? "Someone";
    await notifyResplit(supabase, {
      householdId,
      recipientRoommateId: expense.paid_by,
      expenseId: expense.id,
      message: nextOptedOut
        ? `${actorName} opted out of "${expense.label}" (${currency.format(expense.amount)}).`
        : `${actorName} opted back into "${expense.label}" (${currency.format(expense.amount)}).`,
    });

    setBusy(false);
    router.refresh();
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("expenses")
      .update({ label, amount: parsedAmount, frequency })
      .eq("id", expense.id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${expense.label}"? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("expenses").delete().eq("id", expense.id);
    setBusy(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={saveEdit} className="flex flex-col gap-2 py-3 text-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 sm:py-1"
          />
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 sm:w-28 sm:py-1"
          />
        </div>
        <fieldset className="flex gap-4">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={frequency === "one_time"}
              onChange={() => setFrequency("one_time")}
            />
            One-time
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
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
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-gray-300 px-3 py-1"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{expense.label}</span>
        <span className="font-medium">{currency.format(expense.amount)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>Paid by {payerName}</span>
        <span>·</span>
        <span>{expense.frequency === "one_time" ? "One-time" : "Recurring"}</span>
        <span>·</span>
        <span>{dateFormat.format(new Date(expense.created_at))}</span>
      </div>
      <p className="text-xs text-gray-500">
        Split: {participantNames || "—"}
        {optedOutCount > 0 && ` (${optedOutCount} opted out)`}
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="mt-1 flex justify-end gap-2">
        {!isPayer && myParticipation && (
          <button
            type="button"
            disabled={busy}
            onClick={toggleOptOut}
            className="py-1 text-xs underline disabled:opacity-50"
          >
            {myParticipation.opted_out ? "Opt back in" : "Opt out"}
          </button>
        )}
        {isPayer && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit expense"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              aria-label="Delete expense"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
