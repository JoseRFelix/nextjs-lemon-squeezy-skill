import { CheckoutButton } from "@/components/checkout-button";
import { SubscriptionStatusForm } from "@/components/subscription-status-form";
import { getSubscriptionPlans, type SubscriptionPlan } from "@/lib/lemon-squeezy";
import { env } from "@/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  let plans: SubscriptionPlan[] = [];
  let plansError: string | null = null;

  try {
    plans = await getSubscriptionPlans();
  } catch (error) {
    plansError = error instanceof Error ? error.message : "Unable to load plans.";
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-16 sm:px-10 lg:px-12">
        <section className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
            Lemon Squeezy Subscription
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Sell your subscription from Next.js
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-300">
            This page uses the official Lemon Squeezy SDK for server-side
            checkout creation and sends customers to Lemon Squeezy hosted pages
            for checkout and billing management.
          </p>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.key}
              className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold text-white">{plan.name}</h2>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-zinc-200">
                  {plan.badge}
                </span>
              </div>

              <p className="mt-5 text-sm leading-7 text-zinc-300">{plan.description}</p>

              <div className="mt-8">
                <p className="text-4xl font-semibold text-white">{plan.priceLabel}</p>
                <p className="mt-2 text-sm text-zinc-400">{plan.billingLabel}</p>
                {plan.trialLabel ? (
                  <p className="mt-3 text-sm text-emerald-300">{plan.trialLabel}</p>
                ) : null}
              </div>

              <div className="mt-8">
                <CheckoutButton plan={plan.key} label={`Start ${plan.name}`} />
              </div>
            </article>
          ))}
        </section>

        {!env.LEMONSQUEEZY_WEBHOOK_SECRET ? (
          <section className="mt-10 rounded-3xl border border-amber-400/30 bg-amber-300/10 p-6 text-left text-sm text-amber-50">
            <h2 className="text-lg font-semibold text-white">Finish your setup</h2>
            <p className="mt-2 text-amber-100/90">
              Add <code>LEMONSQUEEZY_WEBHOOK_SECRET</code> to <code>.env.local</code>,
              then restart the dev server.
            </p>
          </section>
        ) : null}

        {plansError ? (
          <section className="mt-10 rounded-3xl border border-rose-400/30 bg-rose-300/10 p-6 text-sm text-rose-100">
            <p>{plansError}</p>
          </section>
        ) : null}

        <div className="mt-10">
          <SubscriptionStatusForm />
        </div>
      </main>
    </div>
  );
}
