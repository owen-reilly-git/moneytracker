"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";

export default function VenmoHandleModal({
  open,
  onClose,
  currentRoommateId,
  currentHandle,
}: {
  open: boolean;
  onClose: () => void;
  currentRoommateId: string;
  currentHandle: string | null;
}) {
  const router = useRouter();
  const [handle, setHandle] = useState(currentHandle ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const trimmed = handle.trim().replace(/^@/, "");
    const { error: updateError } = await supabase
      .from("roommates")
      .update({ venmo_handle: trimmed || null })
      .eq("id", currentRoommateId);
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Your Venmo handle">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-xs text-gray-500">
          Your public Venmo username, so roommates can pay you back. This app never logs into
          Venmo or sees your account — just this handle.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Venmo handle
          <input
            placeholder="@your-handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Modal>
  );
}
