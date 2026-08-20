"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useClickOutside } from "@/lib/useClickOutside";
import VenmoHandleModal from "@/components/VenmoHandleModal";

export default function MenuButton({
  householdId,
  currentRoommateId,
  venmoHandle,
}: {
  householdId: string;
  currentRoommateId: string;
  venmoHandle: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [venmoModalOpen, setVenmoModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleSwitchRooms() {
    if (!window.confirm("Leave this room? You'll need its name and password to rejoin later.")) {
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("roommates")
        .delete()
        .eq("household_id", householdId)
        .eq("user_id", user.id);
    }

    setBusy(false);
    router.push("/join");
    router.refresh();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        className="flex h-11 w-11 items-center justify-center rounded-md bg-gray-200 text-xl leading-none text-black"
      >
        ☰
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white p-2 text-gray-900 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setVenmoModalOpen(true);
              setOpen(false);
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50"
          >
            Venmo handle
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSwitchRooms}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Switch rooms
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      )}

      <VenmoHandleModal
        open={venmoModalOpen}
        onClose={() => setVenmoModalOpen(false)}
        currentRoommateId={currentRoommateId}
        currentHandle={venmoHandle}
      />
    </div>
  );
}
