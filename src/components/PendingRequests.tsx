"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Roommate } from "@/lib/database.types";

export default function PendingRequests({
  pendingRoommates,
}: {
  pendingRoommates: Roommate[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, status: "approved" | "declined") {
    setBusyId(id);
    const supabase = createClient();
    await supabase.from("roommates").update({ status }).eq("id", id);
    setBusyId(null);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h2 className="mb-3 font-medium">Join requests</h2>
      <ul className="flex flex-col gap-2">
        {pendingRoommates.map((roommate) => (
          <li key={roommate.id} className="flex items-center justify-between text-sm">
            <span>
              {roommate.name} <span className="text-gray-500">({roommate.email})</span>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={busyId === roommate.id}
                onClick={() => decide(roommate.id, "approved")}
                className="rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Admit
              </button>
              <button
                type="button"
                disabled={busyId === roommate.id}
                onClick={() => decide(roommate.id, "declined")}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium disabled:opacity-50"
              >
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
