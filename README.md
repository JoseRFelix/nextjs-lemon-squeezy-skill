# Lemon Squeezy Subscription Demo

This project implements a minimal subscription flow in Next.js using:

- the official `@lemonsqueezy/lemonsqueezy.js` SDK
- App Router route handlers for checkout creation and webhook verification
- Lemon.js for the overlay checkout experience

## Setup

1. Copy the example env file:

```bash
cp .env.example .env.local
```

2. Fill in your Lemon Squeezy values:

```bash
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_STORE_ID=...
LEMONSQUEEZY_WEBHOOK_SECRET=...
LEMONSQUEEZY_MONTHLY_VARIANT_ID=...
LEMONSQUEEZY_YEARLY_VARIANT_ID=...
```

`LEMONSQUEEZY_YEARLY_VARIANT_ID` is optional if you only want one plan.

3. Start the app:

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## What the app does

- Renders subscription pricing on `app/page.tsx`
- Creates checkouts on demand through `app/api/checkout/route.ts`
- Verifies webhook signatures in `app/api/webhooks/route.ts`
- Redirects successful purchases to `app/success/page.tsx`

## Lemon Squeezy dashboard setup

Create a webhook in Lemon Squeezy that points to:

```text
https://your-domain.com/api/webhooks
```

For local development, expose your app with a tunnel and use the tunneled URL instead.

Recommended subscription events:

- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `subscription_resumed`
- `subscription_expired`
- `subscription_payment_success`
- `subscription_payment_failed`

## Local development notes

- Use a Lemon Squeezy test-mode API key and store while developing.
- Set `LEMONSQUEEZY_TEST_MODE=true` when using test mode.
- The webhook route currently verifies the signature and logs the event. Replace the log with a database upsert when you connect subscriptions to users.
