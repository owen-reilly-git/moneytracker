"use client";

import { useState } from "react";
import type { Roommate, ExpenseWithParticipants, ExpenseFrequency } from "@/lib/database.types";
import ExpenseRow from "@/components/ExpenseRow";

export default function ExpenseFeed({
  householdId,
  roommates,
  expenses,
  currentRoommateId,
}: {
  householdId: string;
  roommates: Roommate[];
  expenses: ExpenseWithParticipants[];
  currentRoommateId: string;
}) {
  const [roommateFilter, setRoommateFilter] = useState<string>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<ExpenseFrequency | "all">("all");

  const filtered = expenses.filter((expense) => {
    if (roommateFilter !== "all" && expense.paid_by !== roommateFilter) return false;
    if (frequencyFilter !== "all" && expense.frequency !== frequencyFilter) return false;
    return true;
  });

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Expenses</h2>
        <div className="flex gap-2">
          <select
            value={roommateFilter}
            onChange={(e) => setRoommateFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="all">Everyone</option>
            {roommates.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={frequencyFilter}
            onChange={(e) =>
              setFrequencyFilter(e.target.value as ExpenseFrequency | "all")
            }
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="all">All frequencies</option>
            <option value="one_time">One-time</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No expenses match these filters.</p>
      ) : (
        <div className="flex max-h-[32rem] flex-col divide-y divide-gray-100 overflow-y-auto">
          {filtered.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              roommates={roommates}
              currentRoommateId={currentRoommateId}
              householdId={householdId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
