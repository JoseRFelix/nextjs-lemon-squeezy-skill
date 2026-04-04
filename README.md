# Lemon Squeezy Subscription Demo

This project implements a minimal subscription flow in Next.js using:

- the official `@lemonsqueezy/lemonsqueezy.js` SDK
- App Router Route Handlers for checkout creation and webhook verification
- Server Actions as the preferred checkout pattern for in-app use

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

Both variant IDs are required. To use a single plan, create two variants pointing to the same product.

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

## Agent skill

This repo includes a reusable [Lemon Squeezy agent skill](skills/lemonsqueezy-integration/SKILL.md) that teaches coding agents how to integrate Lemon Squeezy into any Next.js project. It covers SDK setup, checkout flows, webhook verification, subscription recovery, and environment configuration.

### Using the skill in this project

The skill is already active for Cursor via a symlink at `.cursor/skills/lemonsqueezy-integration`. No extra setup is needed — Cursor picks it up automatically.

### Installing the skill in another project

Use the [`skills` CLI](https://github.com/vercel-labs/skills) to install it into any supported agent (Cursor, Claude Code, Codex, Windsurf, Cline, and 40+ others):

```bash
# From GitHub
npx skills add JoseRFelix/nextjs-lemon-squeezy-example

# From a local clone
npx skills add ./path/to/nextjs-lemon-squeezy-example
```

You can also target specific agents or install globally:

```bash
# Install to Cursor and Claude Code only
npx skills add JoseRFelix/nextjs-lemon-squeezy-example -a cursor -a claude-code

# Install globally (available across all projects)
npx skills add JoseRFelix/nextjs-lemon-squeezy-example -g
```

Run `npx skills add JoseRFelix/nextjs-lemon-squeezy-example --list` to preview available skills before installing.
