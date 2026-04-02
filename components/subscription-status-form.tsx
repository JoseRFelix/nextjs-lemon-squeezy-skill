"use client";

import { useState } from "react";
import type { RecoveredSubscription } from "@/lib/lemon-squeezy";

type SubscriptionResult = RecoveredSubscription & { error?: string };

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return Number.isNaN(date.getTime())
    ? "N/A"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function SubscriptionStatusForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubscriptionResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/subscription-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as SubscriptionResult;
      if (!response.ok) throw new Error(payload.error ?? "Lookup failed.");
      setResult(payload);
    } catch (caughtError) {
      setResult(null);
      setError(caughtError instanceof Error ? caughtError.message : "Lookup failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
          Recover subscription
        </p>
        <h2 className="mt-4 text-2xl font-semibold text-white">
          Check whether an email already has an active plan
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="customer@example.com"
            className="w-full rounded-full border border-white/10 bg-zinc-900 px-5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-300"
            autoComplete="email"
            required
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Checking..." : "Verify email"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-rose-300" role="alert">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-6">
          <p className="text-sm text-zinc-400">Result for {result.email}</p>

          {result.found ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-medium text-emerald-300">
                  {result.statusFormatted ?? "Found"}
                </span>
                <span className="text-sm text-zinc-400">
                  {result.productName}
                  {result.variantName ? ` · ${result.variantName}` : null}
                </span>
              </div>

              <dl className="mt-6 grid gap-4 text-sm text-zinc-300 sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500">Status</dt>
                  <dd className="mt-1">{result.status ?? "N/A"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Renews at</dt>
                  <dd className="mt-1">{formatDate(result.renewsAt)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Ends at</dt>
                  <dd className="mt-1">{formatDate(result.endsAt)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Trial ends at</dt>
                  <dd className="mt-1">{formatDate(result.trialEndsAt)}</dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {result.manageSubscriptionUrl ? (
                  <a
                    href={result.manageSubscriptionUrl}
                    className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    Manage subscription
                  </a>
                ) : result.customerPortalUrl ? (
                  <a
                    href={result.customerPortalUrl}
                    className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    Customer portal
                  </a>
                ) : null}
                {result.updatePaymentMethodUrl ? (
                  <a
                    href={result.updatePaymentMethodUrl}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                  >
                    Update payment method
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-300">
              No active subscription found for that email.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
