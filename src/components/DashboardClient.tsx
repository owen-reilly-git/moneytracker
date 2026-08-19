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
import HeaderPopover from "@/components/HeaderPopover";
import BalanceHero from "@/components/BalanceHero";
import ExpenseForm from "@/components/ExpenseForm";
import ExpenseFeed from "@/components/ExpenseFeed";
import MonthlySubtotals from "@/components/MonthlySubtotals";
import SettlementList from "@/components/SettlementList";
import PaymentHistory from "@/components/PaymentHistory";

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
          <HeaderPopover label="Add an expense" shortLabel="Add">
            <ExpenseForm currentRoommateId={currentRoommateId} householdId={household.id} />
          </HeaderPopover>
          <HeaderPopover label="Your recurring bills" shortLabel="Bills">
            <MonthlySubtotals roommates={roommates} expenses={expenses} />
          </HeaderPopover>
          <HeaderPopover label="Settle up" shortLabel="Settle">
            <SettlementList roommates={roommates} expenses={expenses} payments={payments} />
          </HeaderPopover>
          <HeaderPopover label="Payment history" shortLabel="History">
            <PaymentHistory roommates={roommates} payments={payments} />
          </HeaderPopover>
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

      <ExpenseFeed
        householdId={household.id}
        roommates={roommates}
        expenses={expenses}
        currentRoommateId={currentRoommateId}
      />
    </main>
  );
}
