"use client";

import { useRef, useState, type ReactNode } from "react";
import { useClickOutside } from "@/lib/useClickOutside";

export default function HeaderPopover({
  label,
  shortLabel,
  badge,
  children,
}: {
  label: string;
  /** Shorter text shown below the `sm` breakpoint so the header row doesn't wrap into a wall of buttons on a phone. */
  shortLabel?: string;
  badge?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 sm:px-3 sm:py-1.5"
      >
        <span className={shortLabel ? "sm:hidden" : undefined}>{shortLabel ?? label}</span>
        {shortLabel && <span className="hidden sm:inline">{label}</span>}
        {!!badge && badge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        // On mobile this is a bottom sheet, not a dropdown anchored to the
        // trigger — with 5+ header buttons wrapping across rows, a button
        // can end up anywhere left-to-right, so a `right-0`-anchored panel
        // would routinely overflow off the left edge of a narrow screen.
        // At `sm:` and up it reverts to a normal anchored dropdown.
        <div className="fixed inset-x-4 bottom-4 z-10 rounded-lg border border-gray-200 bg-white p-3 text-gray-900 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          {children}
        </div>
      )}
    </div>
  );
}
