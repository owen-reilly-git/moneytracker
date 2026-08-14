"use client";

import { useMemo, useState } from "react";
import type { Roommate, Expense, ExpenseFrequency } from "@/lib/database.types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function ExpenseList({
  roommates,
  expenses,
}: {
  roommates: Roommate[];
  expenses: Expense[];
}) {
  const [roommateFilter, setRoommateFilter] = useState<string>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<ExpenseFrequency | "all">("all");

  const roommateNameById = useMemo(
    () => new Map(roommates.map((r) => [r.id, r.name])),
    [roommates],
  );

  const filtered = expenses.filter((expense) => {
    if (roommateFilter !== "all" && expense.paid_by !== roommateFilter) return false;
    if (frequencyFilter !== "all" && expense.frequency !== frequencyFilter) return false;
    return true;
  });

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 font-normal">Label</th>
              <th className="py-2 font-normal">Paid by</th>
              <th className="py-2 font-normal">Frequency</th>
              <th className="py-2 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((expense) => (
              <tr key={expense.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2">{expense.label}</td>
                <td className="py-2">{roommateNameById.get(expense.paid_by) ?? "—"}</td>
                <td className="py-2 capitalize">
                  {expense.frequency === "one_time" ? "One-time" : "Recurring"}
                </td>
                <td className="py-2 text-right">{currency.format(expense.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
