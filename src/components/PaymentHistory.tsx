import type { Roommate, Payment } from "@/lib/database.types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function PaymentHistory({
  roommates,
  payments,
}: {
  roommates: Roommate[];
  payments: Payment[];
}) {
  const nameById = new Map(roommates.map((r) => [r.id, r.name]));

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">Every payment recorded in this household.</p>
      {payments.length === 0 ? (
        <p className="text-sm text-gray-500">No payments recorded yet.</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto text-sm">
          {payments.map((p) => (
            <li key={p.id} className="border-b border-gray-100 pb-2 last:border-0">
              <div className="flex items-center justify-between">
                <span>
                  {nameById.get(p.from_roommate_id) ?? "—"}{" "}
                  <span className="text-gray-400">→</span>{" "}
                  {nameById.get(p.to_roommate_id) ?? "—"}
                </span>
                <span className="font-medium">{currency.format(p.amount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{p.note || ""}</span>
                <span>{dateFormat.format(new Date(p.created_at))}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
