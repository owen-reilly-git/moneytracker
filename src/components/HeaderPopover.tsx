"use client";

import { useRef, useState, type ReactNode } from "react";
import { useClickOutside } from "@/lib/useClickOutside";

export default function HeaderPopover({
  label,
  badge,
  children,
}: {
  label: string;
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
        className="relative rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
      >
        {label}
        {!!badge && badge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-3 text-gray-900 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}
