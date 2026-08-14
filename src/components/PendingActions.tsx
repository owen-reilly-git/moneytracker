"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export default function PendingActions({ declined }: { declined: boolean }) {
  const router = useRouter();

  return (
    <div className="mt-2 flex items-center gap-4">
      {declined ? (
        <Link href="/join" className="text-sm underline">
          Try a different code
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"
        >
          Check again
        </button>
      )}
      <SignOutButton />
    </div>
  );
}
