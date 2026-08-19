"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useClickOutside } from "@/lib/useClickOutside";
import type { Notification } from "@/lib/database.types";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function NotificationBell({
  notifications,
  currentRoommateId,
}: {
  notifications: Notification[];
  currentRoommateId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function markAllRead() {
    if (unreadCount === 0) return;
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_roommate_id", currentRoommateId)
      .is("read_at", null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md border border-gray-300 px-2.5 py-2 text-sm sm:px-3 sm:py-1.5"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 bottom-4 z-10 rounded-lg border border-gray-200 bg-white p-3 text-gray-900 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={markAllRead}
                className="text-xs text-gray-500 underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500">No notifications yet.</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={
                    n.read_at
                      ? "rounded-md p-2 text-sm text-gray-500"
                      : "rounded-md bg-gray-50 p-2 text-sm"
                  }
                >
                  <p>{n.message}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {dateFormat.format(new Date(n.created_at))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
