import type { Roommate, Expense } from "@/lib/database.types";
import { calculateBalances, calculateSettlements } from "@/lib/balances";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function SettlementList({
  roommates,
  expenses,
}: {
  roommates: Roommate[];
  expenses: Expense[];
}) {
  const balances = calculateBalances(roommates, expenses);
  const settlements = calculateSettlements(balances);

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-1 font-medium">Settle up</h2>
      <p className="mb-3 text-xs text-gray-500">
        The smallest set of payments that would bring everyone to $0.
      </p>
      {settlements.length === 0 ? (
        <p className="text-sm text-gray-500">Everyone&apos;s settled up.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {settlements.map((s, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>
                {s.fromName} <span className="text-gray-400">owes</span> {s.toName}
              </span>
              <span className="font-medium">{currency.format(s.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
