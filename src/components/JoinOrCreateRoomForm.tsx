"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinOrCreateRoomForm() {
  const router = useRouter();
  const [yourName, setYourName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("join_or_create_room", {
      p_name: roomName,
      p_password: roomPassword,
      p_your_name: yourName,
    });

    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4"
    >
      <p className="text-xs text-gray-500">
        Enter a room name and password. If it&apos;s a new room, this creates it. If it
        already exists, entering the matching password joins it instantly.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input
          required
          value={yourName}
          onChange={(e) => setYourName(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Room name
        <input
          required
          placeholder="e.g. 42 Elm St"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Room password
        <input
          required
          type="password"
          placeholder="Make one up if you're creating this room"
          value={roomPassword}
          onChange={(e) => setRoomPassword(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Continuing…" : "Continue"}
      </button>
    </form>
  );
}
