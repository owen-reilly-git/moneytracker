"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Settlement } from "@/lib/balances";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function SettleUpLine({
  settlement,
  currentRoommateId,
  householdId,
}: {
  settlement: Settlement;
  currentRoommateId: string;
  householdId: string;
}) {
  const router = useRouter();
  const iOwe = settlement.fromRoommateId === currentRoommateId;

  const [recording, setRecording] = useState(false);
  const [amount, setAmount] = useState(String(settlement.amount));
  const [note, setNote] = useState("");
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
    const { error: insertError } = await supabase.from("payments").insert({
      household_id: householdId,
      from_roommate_id: settlement.fromRoommateId,
      to_roommate_id: settlement.toRoommateId,
      amount: parsedAmount,
      note: note.trim() || null,
    });
    setBusy(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setRecording(false);
    router.refresh();
  }

  return (
    <li>
      <div className="flex items-center justify-between">
        <span className={iOwe ? "text-red-600" : "text-green-700"}>
          {iOwe ? `You owe ${settlement.toName}` : `${settlement.fromName} owes you`}{" "}
          <span className="font-medium">{currency.format(settlement.amount)}</span>
        </span>
        <button
          type="button"
          onClick={() => setRecording((v) => !v)}
          className="text-xs underline"
        >
          {recording ? "Cancel" : "Record payment"}
        </button>
      </div>

      {recording && (
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2 rounded-md bg-gray-50 p-2">
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
            <input
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="self-start rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? "Recording…" : `Record ${iOwe ? "payment to" : "payment from"} ${iOwe ? settlement.toName : settlement.fromName}`}
          </button>
        </form>
      )}
    </li>
  );
}
