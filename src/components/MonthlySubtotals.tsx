import type { Roommate, Expense } from "@/lib/database.types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function MonthlySubtotals({
  roommates,
  expenses,
}: {
  roommates: Roommate[];
  expenses: Expense[];
}) {
  const subtotals = roommates.map((roommate) => {
    const total = expenses
      .filter((e) => e.paid_by === roommate.id && e.frequency === "recurring")
      .reduce((sum, e) => sum + e.amount, 0);
    return { roommate, total };
  });

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        What each person personally pays toward standing monthly bills — not a balance.
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {subtotals.map(({ roommate, total }) => (
          <li key={roommate.id} className="flex items-center justify-between">
            <span>{roommate.name}</span>
            <span className="font-medium">{currency.format(total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
