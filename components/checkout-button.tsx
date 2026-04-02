"use client";

import { useState } from "react";
import type { PlanKey } from "@/lib/lemon-squeezy";

export function CheckoutButton({ plan, label }: { plan: PlanKey; label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Checkout failed.");

      window.location.assign(payload.url);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Checkout failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Opening checkout..." : label}
      </button>
      {error ? (
        <p className="text-sm text-rose-300" role="alert">{error}</p>
      ) : null}
    </div>
  );
}
