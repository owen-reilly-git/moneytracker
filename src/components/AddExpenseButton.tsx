"use client";

import { useState } from "react";
import ExpenseForm from "@/components/ExpenseForm";
import Modal from "@/components/Modal";

export default function AddExpenseButton({
  currentRoommateId,
  householdId,
}: {
  currentRoommateId: string;
  householdId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex justify-center py-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add an expense"
        className="flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-4xl font-light leading-none text-white shadow-lg transition-transform active:scale-95 sm:h-24 sm:w-24"
      >
        +
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add an expense">
        <ExpenseForm
          currentRoommateId={currentRoommateId}
          householdId={householdId}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </div>
  );
}
