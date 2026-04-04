---

## name: lemonsqueezy-integration

description: >-
  Integrate Lemon Squeezy payments and subscriptions using
  @lemonsqueezy/lemonsqueezy.js. Covers SDK setup, hosted checkout, webhook
  signature verification, subscription recovery, and environment variable
  configuration. Use when adding Lemon Squeezy, payments, checkout, webhooks,
  subscriptions, or billing to a project.

# Lemon Squeezy Integration

## SDK & Setup

Package: `@lemonsqueezy/lemonsqueezy.js` (v4+).

```bash
npm install @lemonsqueezy/lemonsqueezy.js
```

Call `lemonSqueezySetup({ apiKey })` once before any API call. Use a lazy
singleton to avoid redundant setup. Import `env` from the project's central
`@t3-oss/env-nextjs` file — never read `process.env` directly:

```ts
import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";
import { env } from "@lib/env";

let configured = false;

function ensureSetup() {
  if (configured) return;
  lemonSqueezySetup({ apiKey: env.LEMONSQUEEZY_API_KEY });
  configured = true;
}
```

Every exported function that touches the SDK should call `ensureSetup()` first.

## Environment Variables

All Lemon Squeezy env vars are **server-only** — never expose them to the
client via `NEXT_PUBLIC_`*. Define them in the project's central `env.ts` using
`@t3-oss/env-nextjs` + Zod so they are validated at startup:

```ts
// inside createEnv({ server: { ... } })
LEMONSQUEEZY_API_KEY: z.string().min(1),
LEMONSQUEEZY_STORE_ID: z.coerce.number().int().positive(),
LEMONSQUEEZY_MONTHLY_VARIANT_ID: z.coerce.number().int().positive(),
LEMONSQUEEZY_YEARLY_VARIANT_ID: z.coerce.number().int().positive(),
LEMONSQUEEZY_TEST_MODE: z.enum(["true","false","1","0"]).optional()
  .transform((v) => v === "true" || v === "1"),
LEMONSQUEEZY_REDIRECT_URL: z.string().url().optional(),
```

Then import `env` from the central file and access values like
`env.LEMONSQUEEZY_API_KEY`. **Do not** use `process.env` directly or manual
`requireEnv` helpers — t3-env handles validation and type coercion.

| Variable                          | Required | Zod type                           | Notes                                |
| --------------------------------- | -------- | ---------------------------------- | ------------------------------------ |
| `LEMONSQUEEZY_API_KEY`            | yes      | `z.string().min(1)`                | From LS dashboard → API Keys         |
| `LEMONSQUEEZY_STORE_ID`           | yes      | `z.coerce.number().int().positive()` | Store numeric ID                   |
| `LEMONSQUEEZY_MONTHLY_VARIANT_ID` | yes      | `z.coerce.number().int().positive()` | Monthly plan variant ID            |
| `LEMONSQUEEZY_YEARLY_VARIANT_ID`  | yes      | `z.coerce.number().int().positive()` | Yearly plan variant ID             |
| `LEMONSQUEEZY_TEST_MODE`          | no       | boolean transform                  | `"true"` / `"false"` / `"1"` / `"0"` |
| `LEMONSQUEEZY_REDIRECT_URL`       | no       | `z.string().url().optional()`      | Override default success URL         |

The webhook secret (`LEMONSQUEEZY_WEBHOOK_SECRET`) lives in the Convex env
(set via `npx convex env set`) since the webhook handler runs as a Convex
HTTP action, not a Next.js route.

See [reference.md § Environment Schema](reference.md#environment-schema) for
the full schema.

## Hosted Checkout (Redirect)

Use `createCheckout(storeId, variantId, options)` to create a Lemon Squeezy
hosted checkout URL, then redirect the user.

Key options:

```ts
{
  productOptions: {
    redirectUrl: "https://example.com/success?plan=monthly",
    enabledVariants: [variantId],
  },
  checkoutOptions: {
    embed: false,   // full-page redirect (not overlay)
    media: false,
    logo: false,
    subscriptionPreview: true,
  },
  checkoutData: email ? { email } : undefined,
  testMode: env.LEMONSQUEEZY_TEST_MODE,
}
```

**Two patterns for triggering checkout from the client:**

1. **Server Action** (preferred for in-app mutations): define a `'use server'`
  function that creates the URL, then call `redirect()` or return the URL to
   the client. Avoids an extra Route Handler.
2. **Route Handler**: `POST /api/checkout` accepts `{ plan, email? }`, returns
  `{ url }`. Client calls the route then `window.location.assign(url)`. Use
   this when you need a public API endpoint or non-React clients.

## Webhook Signature Verification

Lemon Squeezy signs webhooks with HMAC-SHA256. Verify manually:

1. Read body as **raw text** (`request.text()`, not `.json()`).
2. Get the `X-Signature` header.
3. Compute `HMAC-SHA256(secret, rawBody)` → hex digest.
4. Compare with `crypto.timingSafeEqual` on hex buffers (check length first).

```ts
import crypto from "node:crypto";

const expected = Buffer.from(
  crypto.createHmac("sha256", secret).update(rawBody).digest("hex"),
  "hex",
);
const received = Buffer.from(signature, "hex");

const valid =
  received.length === expected.length &&
  crypto.timingSafeEqual(expected, received);
```

After verification, parse JSON and route by `payload.meta.event_name`. Common
events: `subscription_created`, `subscription_updated`,
`subscription_cancelled`, `subscription_payment_success`,
`subscription_payment_failed`, `order_created`.

Use `after()` from `next/server` to schedule business logic (DB writes,
notifications) after responding with `200 OK` so Lemon Squeezy doesn't time
out waiting for your handler.

## Subscription Recovery

Look up a customer's most relevant subscription by email:

1. `listCustomers({ filter: { storeId, email } })` — find the customer record.
2. `listSubscriptions({ filter: { storeId, userEmail } })` — get all subs.
3. Sort by status priority (active > on_trial > paused > cancelled > past_due >
  unpaid > expired), then by `updated_at` descending.
4. Return the top subscription's portal URLs for self-service management.

Portal URLs available on `subscription.attributes.urls`:

- `customer_portal` — full portal
- `customer_portal_update_subscription` — change/cancel plan
- `update_payment_method` — update card

## Fetching Plan Details

Use `getStore`, `getVariant`, and `listPrices` to build pricing UI server-side:

1. `getStore(storeId)` → currency.
2. `getVariant(variantId)` → name, description.
3. `listPrices({ filter: { variantId } })` → unit price, renewal interval,
  trial info.
4. Format with `Intl.NumberFormat` (prices are in cents).

## Client Components

Checkout and subscription-lookup UIs are `"use client"` components. They call
server-side logic — never the Lemon Squeezy API directly from the browser.

- **CheckoutButton**: invokes a Server Action or `POST /api/checkout` with
`{ plan }`, then redirects to the returned URL.
- **SubscriptionStatusForm**: calls `POST /api/subscription-status` with
`{ email }`, displays status and portal links.

Both follow the pattern: `useState` for pending/error, call the server, handle
errors, render result.

## Next.js Best Practices

- **Prefer Server Actions for in-app mutations** (checkout). Use Route Handlers
for external-facing endpoints (webhooks) or when you need a public API.
- **Use `after()` in webhook handlers** to respond immediately and process
events in the background. Import from `next/server`.
- **Use `Response.json()` in Route Handlers** for simple JSON responses.
`NextResponse` is only needed for `.redirect()`, `.rewrite()`, or cookie
helpers.
- **Request APIs are async in Next.js 16**: `await cookies()`,
`await headers()`, `await params`. If you extend these patterns with request
introspection, remember to await.
- `**proxy.ts` replaces `middleware.ts`** in Next.js 16. Place it next to
`app/`. Use it for auth checks or request interception before Route Handlers.

## Full Code Examples

For complete, copy-pasteable implementations of every pattern above, see
[reference.md](reference.md).