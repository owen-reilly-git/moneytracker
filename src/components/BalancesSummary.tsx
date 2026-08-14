import type { Roommate, Expense } from "@/lib/database.types";
import { calculateBalances } from "@/lib/balances";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function BalancesSummary({
  roommates,
  expenses,
}: {
  roommates: Roommate[];
  expenses: Expense[];
}) {
  const balances = calculateBalances(roommates, expenses);

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-1 font-medium">What everyone owes</h2>
      <p className="mb-3 text-xs text-gray-500">
        Every expense split equally across {roommates.length} roommate
        {roommates.length === 1 ? "" : "s"}. Positive = owed to them, negative
        = they owe the house.
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {balances.map(({ roommateId, name, balance }) => (
          <li key={roommateId} className="flex items-center justify-between">
            <span>{name}</span>
            <span
              className={
                balance > 0
                  ? "font-medium text-green-700"
                  : balance < 0
                    ? "font-medium text-red-600"
                    : "font-medium text-gray-500"
              }
            >
              {balance > 0 ? "+" : ""}
              {currency.format(balance)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
