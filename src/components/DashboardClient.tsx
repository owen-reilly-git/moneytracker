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
import PendingRequests from "@/components/PendingRequests";

export default function DashboardClient({
  household,
  roommates,
  expenses,
  notifications,
  payments,
  currentRoommateId,
  isOwner,
}: {
  household: Household;
  roommates: Roommate[];
  expenses: ExpenseWithParticipants[];
  notifications: Notification[];
  payments: Payment[];
  currentRoommateId: string;
  isOwner: boolean;
}) {
  const approvedRoommates = roommates.filter((r) => r.status === "approved");
  const pendingRoommates = roommates.filter((r) => r.status === "pending");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{household.name}</h1>
          <p className="text-xs text-gray-500">Home code: {household.home_code}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HeaderPopover label="Add an expense">
            <ExpenseForm currentRoommateId={currentRoommateId} householdId={household.id} />
          </HeaderPopover>
          <HeaderPopover label="Your recurring bills">
            <MonthlySubtotals roommates={approvedRoommates} expenses={expenses} />
          </HeaderPopover>
          <HeaderPopover label="Settle up">
            <SettlementList roommates={approvedRoommates} expenses={expenses} payments={payments} />
          </HeaderPopover>
          <HeaderPopover label="Payment history">
            <PaymentHistory roommates={approvedRoommates} payments={payments} />
          </HeaderPopover>
          {isOwner && (
            <HeaderPopover label="Requests" badge={pendingRoommates.length}>
              {pendingRoommates.length === 0 ? (
                <p className="text-sm text-gray-500">No pending requests.</p>
              ) : (
                <PendingRequests pendingRoommates={pendingRoommates} />
              )}
            </HeaderPopover>
          )}
          <NotificationBell notifications={notifications} currentRoommateId={currentRoommateId} />
          <SignOutButton />
        </div>
      </header>

      <BalanceHero
        roommates={approvedRoommates}
        expenses={expenses}
        payments={payments}
        currentRoommateId={currentRoommateId}
        householdId={household.id}
      />

      <ExpenseFeed
        householdId={household.id}
        roommates={approvedRoommates}
        expenses={expenses}
        currentRoommateId={currentRoommateId}
      />
    </main>
  );
}
