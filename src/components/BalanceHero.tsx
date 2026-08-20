"use client";

import { useState } from "react";
import type { Roommate, ExpenseWithParticipants, Payment } from "@/lib/database.types";
import { calculateBalances, calculateSettlements } from "@/lib/balances";
import SettleUpLine from "@/components/SettleUpLine";
import Modal from "@/components/Modal";
import SettlementList from "@/components/SettlementList";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const SETTLED_EPSILON = 0.005;

export default function BalanceHero({
  roommates,
  expenses,
  payments,
  currentRoommateId,
  householdId,
}: {
  roommates: Roommate[];
  expenses: ExpenseWithParticipants[];
  payments: Payment[];
  currentRoommateId: string;
  householdId: string;
}) {
  const [open, setOpen] = useState(false);
  const balances = calculateBalances(roommates, expenses, payments);
  const mine = balances.find((b) => b.roommateId === currentRoommateId);
  const net = mine?.balance ?? 0;
  const settled = Math.abs(net) < SETTLED_EPSILON;
  const owedToMe = net > 0;

  const myLines = calculateSettlements(balances).filter(
    (s) => s.fromRoommateId === currentRoommateId || s.toRoommateId === currentRoommateId,
  );

  return (
    <section className="rounded-lg border border-gray-200 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left"
        aria-haspopup="dialog"
      >
        <p className="text-sm text-gray-500">Your balance</p>
        <p
          className={
            settled
              ? "text-2xl font-semibold text-gray-900 sm:text-3xl"
              : owedToMe
                ? "text-3xl font-semibold text-green-700 sm:text-4xl"
                : "text-3xl font-semibold text-red-600 sm:text-4xl"
          }
        >
          {settled
            ? "You're settled up"
            : `${owedToMe ? "+" : "-"}${currency.format(Math.abs(net))}`}
        </p>
        {!settled && (
          <p className="mt-1 text-sm text-gray-500">
            {owedToMe ? "you are owed overall" : "you owe overall"}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400 underline">Settle up</p>
      </button>

      {myLines.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3 text-sm">
          {myLines.map((s, i) => (
            <SettleUpLine
              key={i}
              settlement={s}
              currentRoommateId={currentRoommateId}
              householdId={householdId}
            />
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Settle up">
        <SettlementList roommates={roommates} expenses={expenses} payments={payments} />
      </Modal>
    </section>
  );
}
