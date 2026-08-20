"use client";

import type {
  Household,
  Roommate,
  ExpenseWithParticipants,
  Notification,
  Payment,
} from "@/lib/database.types";
import NotificationBell from "@/components/NotificationBell";
import MenuButton from "@/components/MenuButton";
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
      <header className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold sm:text-2xl">{household.name}</h1>
          <p className="text-xs text-gray-500">Room password: {household.password}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell notifications={notifications} currentRoommateId={currentRoommateId} />
          <MenuButton householdId={household.id} />
        </div>
      </header>

      <BalanceHero
        roommates={roommates}
        expenses={expenses}
        payments={payments}
        currentRoommateId={currentRoommateId}
        householdId={household.id}
      />

      <div className="relative mb-10 sm:mb-12">
        <ExpenseFeed
          householdId={household.id}
          roommates={roommates}
          expenses={expenses}
          currentRoommateId={currentRoommateId}
        />
        <div className="absolute inset-x-0 bottom-0 z-10 flex translate-y-1/2 justify-center">
          <AddExpenseButton currentRoommateId={currentRoommateId} householdId={household.id} />
        </div>
      </div>
    </main>
  );
}
