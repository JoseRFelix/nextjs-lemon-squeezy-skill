# Lemon Squeezy — Reference Implementations

Complete code examples for each integration pattern. Adapt paths, styling, and
framework conventions to your project.

---

## Environment Schema

Using `@t3-oss/env-nextjs` + Zod:

```ts
// env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();

const booleanWithDefaultFalse = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => value === "true" || value === "1");

export const env = createEnv({
  server: {
    LEMONSQUEEZY_API_KEY: z.string().min(1),
    LEMONSQUEEZY_STORE_ID: positiveInteger,
    LEMONSQUEEZY_WEBHOOK_SECRET: z.string().min(1).optional(),
    LEMONSQUEEZY_MONTHLY_VARIANT_ID: positiveInteger,
    LEMONSQUEEZY_YEARLY_VARIANT_ID: positiveInteger,
    LEMONSQUEEZY_TEST_MODE: booleanWithDefaultFalse,
    LEMONSQUEEZY_REDIRECT_URL: z.string().url().optional(),
  },
  client: {},
  runtimeEnv: {
    LEMONSQUEEZY_API_KEY: process.env.LEMONSQUEEZY_API_KEY,
    LEMONSQUEEZY_STORE_ID: process.env.LEMONSQUEEZY_STORE_ID,
    LEMONSQUEEZY_WEBHOOK_SECRET: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
    LEMONSQUEEZY_MONTHLY_VARIANT_ID: process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID,
    LEMONSQUEEZY_YEARLY_VARIANT_ID: process.env.LEMONSQUEEZY_YEARLY_VARIANT_ID,
    LEMONSQUEEZY_TEST_MODE: process.env.LEMONSQUEEZY_TEST_MODE,
    LEMONSQUEEZY_REDIRECT_URL: process.env.LEMONSQUEEZY_REDIRECT_URL,
  },
  emptyStringAsUndefined: true,
});
```

`.env.example`:

```
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_MONTHLY_VARIANT_ID=
LEMONSQUEEZY_YEARLY_VARIANT_ID=
LEMONSQUEEZY_TEST_MODE=false
LEMONSQUEEZY_REDIRECT_URL=
```

---

## Core Library (`lib/lemon-squeezy.ts`)

```ts
import {
  createCheckout,
  getStore,
  getVariant,
  lemonSqueezySetup,
  listCustomers,
  listPrices,
  listSubscriptions,
} from "@lemonsqueezy/lemonsqueezy.js";
import { env } from "@/env";

// ── Types ──────────────────────────────────────────────────────────

export type PlanKey = "monthly" | "yearly";

export function isPlanKey(value: unknown): value is PlanKey {
  return value === "monthly" || value === "yearly";
}

export type SubscriptionPlan = {
  key: PlanKey;
  variantId: number;
  name: string;
  description: string;
  badge: string;
  priceLabel: string;
  billingLabel: string;
  trialLabel: string | null;
};

export type RecoveredSubscription = {
  found: boolean;
  email: string;
  subscriptionId: string | null;
  customerId: string | null;
  productName: string | null;
  variantName: string | null;
  status: string | null;
  statusFormatted: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  trialEndsAt: string | null;
  manageSubscriptionUrl: string | null;
  customerPortalUrl: string | null;
  updatePaymentMethodUrl: string | null;
};

// ── Plan Config ────────────────────────────────────────────────────

const PLANS: Record<PlanKey, { variantId: number; badge: string }> = {
  monthly: { variantId: env.LEMONSQUEEZY_MONTHLY_VARIANT_ID, badge: "Most flexible" },
  yearly:  { variantId: env.LEMONSQUEEZY_YEARLY_VARIANT_ID,  badge: "Best value" },
};

// ── SDK singleton ──────────────────────────────────────────────────

let configured = false;

function ensureSetup() {
  if (configured) return;
  lemonSqueezySetup({ apiKey: env.LEMONSQUEEZY_API_KEY });
  configured = true;
}

// ── Helpers ────────────────────────────────────────────────────────

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatBillingLabel(unit: string | null, quantity: number | null): string {
  if (!unit || !quantity) return "One-time purchase";
  return quantity === 1 ? `per ${unit}` : `every ${quantity} ${unit}s`;
}

function formatTrialLabel(unit: string | null, quantity: number | null): string | null {
  if (!unit || !quantity) return null;
  return `${quantity} ${quantity === 1 ? unit : `${unit}s`} free trial`;
}

function stripHtml(html: string | null | undefined): string {
  return html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

// ── Subscription Plans (server-side pricing UI) ────────────────────

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  ensureSetup();

  const storeResponse = await getStore(env.LEMONSQUEEZY_STORE_ID);
  if (storeResponse.error || !storeResponse.data) throw new Error("Unable to load store.");
  const currency = storeResponse.data.data.attributes.currency;

  return Promise.all(
    (Object.keys(PLANS) as PlanKey[]).map(async (key) => {
      const { variantId, badge } = PLANS[key];
      const [variantResponse, pricesResponse] = await Promise.all([
        getVariant(variantId),
        listPrices({ filter: { variantId } }),
      ]);

      if (variantResponse.error || !variantResponse.data)
        throw new Error(`Unable to load ${key} variant.`);
      if (pricesResponse.error || !pricesResponse.data)
        throw new Error(`Unable to load ${key} pricing.`);

      const variant = variantResponse.data.data.attributes;
      const price = pricesResponse.data.data.at(0)?.attributes;
      if (!price) throw new Error(`No price for ${key} plan.`);

      const cents = price.unit_price_decimal
        ? Number.parseFloat(price.unit_price_decimal)
        : price.unit_price;

      return {
        key,
        variantId,
        name: variant.name || key,
        description: stripHtml(variant.description) || `${key} subscription plan.`,
        badge,
        priceLabel: formatMoney(cents, currency),
        billingLabel: formatBillingLabel(price.renewal_interval_unit, price.renewal_interval_quantity),
        trialLabel: formatTrialLabel(price.trial_interval_unit, price.trial_interval_quantity),
      };
    }),
  );
}

// ── Checkout URL ───────────────────────────────────────────────────

export async function createCheckoutUrl(
  planKey: PlanKey,
  origin: string,
  email?: string,
): Promise<string> {
  ensureSetup();

  const { variantId } = PLANS[planKey];
  const successUrl = new URL("/success", origin);
  successUrl.searchParams.set("plan", planKey);

  const checkoutResponse = await createCheckout(env.LEMONSQUEEZY_STORE_ID, variantId, {
    productOptions: {
      redirectUrl: env.LEMONSQUEEZY_REDIRECT_URL ?? successUrl.toString(),
      enabledVariants: [variantId],
    },
    checkoutOptions: {
      embed: false,
      media: false,
      logo: false,
      subscriptionPreview: true,
    },
    checkoutData: email ? { email } : undefined,
    testMode: env.LEMONSQUEEZY_TEST_MODE,
  });

  if (checkoutResponse.error || !checkoutResponse.data) {
    throw new Error("Unable to create checkout.");
  }
  return checkoutResponse.data.data.attributes.url;
}

// ── Subscription Recovery ──────────────────────────────────────────

const STATUS_PRIORITY: Record<string, number> = {
  active: 7, on_trial: 6, paused: 5, cancelled: 4,
  past_due: 3, unpaid: 2, expired: 1,
};

export async function recoverSubscription(email: string): Promise<RecoveredSubscription> {
  ensureSetup();

  const normalizedEmail = email.trim().toLowerCase();

  const [customersResponse, subscriptionsResponse] = await Promise.all([
    listCustomers({
      filter: { storeId: env.LEMONSQUEEZY_STORE_ID, email: normalizedEmail },
    }),
    listSubscriptions({
      filter: { storeId: env.LEMONSQUEEZY_STORE_ID, userEmail: normalizedEmail },
    }),
  ]);

  if (customersResponse.error || subscriptionsResponse.error) {
    throw new Error("Unable to recover subscription from Lemon Squeezy.");
  }

  const customer = customersResponse.data?.data.at(0);
  const sortedSubscriptions = [...(subscriptionsResponse.data?.data ?? [])].sort(
    (left, right) => {
      const priorityDelta =
        (STATUS_PRIORITY[right.attributes.status] ?? 0) -
        (STATUS_PRIORITY[left.attributes.status] ?? 0);
      if (priorityDelta !== 0) return priorityDelta;
      return (
        new Date(right.attributes.updated_at).getTime() -
        new Date(left.attributes.updated_at).getTime()
      );
    },
  );

  const subscription = sortedSubscriptions.at(0);
  if (!subscription) {
    return {
      found: false, email: normalizedEmail,
      subscriptionId: null, customerId: customer?.id ?? null,
      productName: null, variantName: null,
      status: null, statusFormatted: null,
      renewsAt: null, endsAt: null, trialEndsAt: null,
      manageSubscriptionUrl: null, customerPortalUrl: null,
      updatePaymentMethodUrl: null,
    };
  }

  const attributes = subscription.attributes;
  return {
    found: true, email: normalizedEmail,
    subscriptionId: subscription.id,
    customerId: customer?.id ?? String(attributes.customer_id),
    productName: attributes.product_name,
    variantName: attributes.variant_name,
    status: attributes.status,
    statusFormatted: attributes.status_formatted,
    renewsAt: attributes.renews_at,
    endsAt: attributes.ends_at,
    trialEndsAt: attributes.trial_ends_at,
    manageSubscriptionUrl: attributes.urls.customer_portal_update_subscription,
    customerPortalUrl: attributes.urls.customer_portal,
    updatePaymentMethodUrl: attributes.urls.update_payment_method,
  };
}
```

---

## Checkout — Server Action (preferred)

Server Actions are the Next.js recommended approach for in-app mutations.
The client component calls the action directly — no Route Handler needed.

```ts
// app/actions/checkout.ts
"use server";

import { redirect } from "next/navigation";
import { createCheckoutUrl, isPlanKey } from "@/lib/lemon-squeezy";
import { headers } from "next/headers";

export async function checkoutAction(plan: string, email?: string) {
  if (!isPlanKey(plan)) throw new Error("Invalid plan.");

  const headersList = await headers();
  const origin = headersList.get("origin") ?? headersList.get("host") ?? "";
  const resolvedOrigin = origin.startsWith("http") ? origin : `https://${origin}`;

  const url = await createCheckoutUrl(plan, resolvedOrigin, email?.trim() || undefined);
  redirect(url);
}
```

Usage from a Client Component:

```tsx
"use client";

import { useTransition } from "react";
import { checkoutAction } from "@/app/actions/checkout";
import type { PlanKey } from "@/lib/lemon-squeezy";

export function CheckoutButton({ plan, label }: { plan: PlanKey; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => checkoutAction(plan))}
    >
      {pending ? "Opening checkout..." : label}
    </button>
  );
}
```

## Checkout — Route Handler (alternative)

Use a Route Handler when you need a public API endpoint or non-React clients.

```ts
// app/api/checkout/route.ts
import type { NextRequest } from "next/server";
import { createCheckoutUrl, isPlanKey } from "@/lib/lemon-squeezy";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    plan?: string;
    email?: string;
  } | null;

  const plan = body?.plan;
  if (!isPlanKey(plan)) {
    return Response.json({ error: "Invalid plan." }, { status: 400 });
  }

  try {
    const url = await createCheckoutUrl(plan, request.nextUrl.origin, body?.email?.trim() || undefined);
    return Response.json({ url });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 500 },
    );
  }
}
```

---

## Webhook Route

Uses `after()` to respond with `200 OK` immediately and process the event in
the background so Lemon Squeezy doesn't time out waiting for your handler.

```ts
// app/api/webhooks/route.ts
import crypto from "node:crypto";
import { after } from "next/server";
import { env } from "@/env";

export async function POST(request: Request) {
  const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature") ?? "";
  if (!rawBody || !signature) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const expectedSignature = Buffer.from(
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex"),
    "hex",
  );
  const receivedSignature = Buffer.from(signature, "hex");

  if (
    receivedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  const payload = JSON.parse(rawBody);

  after(() => {
    const eventName: string = payload?.meta?.event_name ?? "unknown";

    switch (eventName) {
      case "subscription_created":
        // Provision access, store subscription in DB
        break;
      case "subscription_updated":
        // Update stored plan/status
        break;
      case "subscription_cancelled":
        // Mark subscription as cancelled, schedule access revocation
        break;
      case "subscription_payment_success":
        // Record payment, extend access
        break;
      case "subscription_payment_failed":
        // Notify user, flag account
        break;
      case "order_created":
        // Handle one-time purchases
        break;
      default:
        console.info("Unhandled Lemon Squeezy event", { event: eventName });
    }
  });

  return Response.json({ ok: true });
}
```

---

## Subscription Status Route Handler

```ts
// app/api/subscription-status/route.ts
import { recoverSubscription } from "@/lib/lemon-squeezy";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim();

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email required." }, { status: 400 });
  }

  try {
    return Response.json(await recoverSubscription(email));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Lookup failed." },
      { status: 500 },
    );
  }
}
```

---

## Client: Checkout Button (Route Handler variant)

Use this when you opted for the Route Handler checkout pattern instead of
Server Actions.

```tsx
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
    <div>
      <button type="button" onClick={handleClick} disabled={pending}>
        {pending ? "Opening checkout..." : label}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
```

---

## Client: Subscription Status Form

```tsx
"use client";

import { useState } from "react";
import type { RecoveredSubscription } from "@/lib/lemon-squeezy";

type SubscriptionResult = RecoveredSubscription & { error?: string };

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
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="customer@example.com"
        autoComplete="email"
        required
      />
      <button type="submit" disabled={pending}>
        {pending ? "Checking..." : "Verify email"}
      </button>

      {error ? <p role="alert">{error}</p> : null}

      {result?.found ? (
        <div>
          <p>Status: {result.statusFormatted ?? result.status}</p>
          <p>Product: {result.productName}{result.variantName ? ` · ${result.variantName}` : ""}</p>
          {result.customerPortalUrl ? <a href={result.customerPortalUrl}>Customer portal</a> : null}
          {result.updatePaymentMethodUrl ? <a href={result.updatePaymentMethodUrl}>Update payment</a> : null}
        </div>
      ) : result ? (
        <p>No active subscription found for that email.</p>
      ) : null}
    </form>
  );
}
```
