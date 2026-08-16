"use client";

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-gray-500">
        moneytracker needs a connection to load your household&apos;s expenses and balances.
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"
      >
        Try again
      </button>
    </main>
  );
}
