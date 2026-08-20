"use client";

export default function AddExpenseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add an expense"
      className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-black bg-green-600 text-4xl font-light leading-none text-white shadow-lg transition-transform active:scale-95 sm:h-24 sm:w-24"
    >
      +
    </button>
  );
}
