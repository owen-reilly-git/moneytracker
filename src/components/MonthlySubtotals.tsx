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
    <section className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-3 font-medium">Monthly recurring subtotal</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {subtotals.map(({ roommate, total }) => (
          <li key={roommate.id} className="flex items-center justify-between">
            <span>{roommate.name}</span>
            <span className="font-medium">{currency.format(total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
