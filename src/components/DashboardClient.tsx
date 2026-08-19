"use client";

import type {
  Household,
  Roommate,
  ExpenseWithParticipants,
  Notification,
  Payment,
} from "@/lib/database.types";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import BalanceHero from "@/components/BalanceHero";
import AddExpenseButton from "@/components/AddExpenseButton";
import ExpenseFeed from "@/components/ExpenseFeed";

export default function DashboardClient({
  household,
  roommates,
  expenses,
  notifications,
  payments,
  currentRoommateId,
}: {
  household: Household;
  roommates: Roommate[];
  expenses: ExpenseWithParticipants[];
  notifications: Notification[];
  payments: Payment[];
  currentRoommateId: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 pb-32 sm:gap-8 sm:p-6 sm:pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{household.name}</h1>
          <p className="text-xs text-gray-500">Room password: {household.password}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationBell notifications={notifications} currentRoommateId={currentRoommateId} />
          <SignOutButton />
        </div>
      </header>

      <BalanceHero
        roommates={roommates}
        expenses={expenses}
        payments={payments}
        currentRoommateId={currentRoommateId}
        householdId={household.id}
      />

      <AddExpenseButton currentRoommateId={currentRoommateId} householdId={household.id} />

      <ExpenseFeed
        householdId={household.id}
        roommates={roommates}
        expenses={expenses}
        currentRoommateId={currentRoommateId}
      />
    </main>
  );
}
