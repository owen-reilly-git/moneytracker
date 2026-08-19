"use client";

import type { ReactNode } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 text-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          {title ? <h2 className="font-medium">{title}</h2> : <span />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
