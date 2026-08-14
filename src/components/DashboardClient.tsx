"use client";

import type { Household, Roommate, Expense } from "@/lib/database.types";
import SignOutButton from "@/components/SignOutButton";
import ExpenseForm from "@/components/ExpenseForm";
import ExpenseList from "@/components/ExpenseList";
import MonthlySubtotals from "@/components/MonthlySubtotals";
import BalancesSummary from "@/components/BalancesSummary";
import SettlementList from "@/components/SettlementList";
import PendingRequests from "@/components/PendingRequests";

export default function DashboardClient({
  household,
  roommates,
  expenses,
  currentRoommateId,
  isOwner,
}: {
  household: Household;
  roommates: Roommate[];
  expenses: Expense[];
  currentRoommateId: string;
  isOwner: boolean;
}) {
  const approvedRoommates = roommates.filter((r) => r.status === "approved");
  const pendingRoommates = roommates.filter((r) => r.status === "pending");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{household.name}</h1>
          <p className="text-xs text-gray-500">Home code: {household.home_code}</p>
        </div>
        <SignOutButton />
      </header>

      {isOwner && pendingRoommates.length > 0 && (
        <PendingRequests pendingRoommates={pendingRoommates} />
      )}

      <section className="grid gap-6 sm:grid-cols-2">
        <ExpenseForm currentRoommateId={currentRoommateId} householdId={household.id} />
        <div className="flex flex-col gap-6">
          <MonthlySubtotals roommates={approvedRoommates} expenses={expenses} />
          <BalancesSummary roommates={approvedRoommates} expenses={expenses} />
          <SettlementList roommates={approvedRoommates} expenses={expenses} />
        </div>
      </section>

      <ExpenseList roommates={approvedRoommates} expenses={expenses} />
    </main>
  );
}
