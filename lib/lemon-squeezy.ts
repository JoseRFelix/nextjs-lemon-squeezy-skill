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

const PLANS: Record<PlanKey, { variantId: number; badge: string }> = {
  monthly: {
    variantId: env.LEMONSQUEEZY_MONTHLY_VARIANT_ID,
    badge: "Most flexible",
  },
  yearly: {
    variantId: env.LEMONSQUEEZY_YEARLY_VARIANT_ID,
    badge: "Best value",
  },
};

let configured = false;

function ensureSetup() {
  if (configured) return;
  lemonSqueezySetup({ apiKey: env.LEMONSQUEEZY_API_KEY });
  configured = true;
}

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

      if (variantResponse.error || !variantResponse.data) {
        throw new Error(`Unable to load ${key} variant.`);
      }
      if (pricesResponse.error || !pricesResponse.data) {
        throw new Error(`Unable to load ${key} pricing.`);
      }

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

const STATUS_PRIORITY: Record<string, number> = {
  active: 7, on_trial: 6, paused: 5, cancelled: 4, past_due: 3, unpaid: 2, expired: 1,
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
  const sortedSubscriptions = [...(subscriptionsResponse.data?.data ?? [])].sort((left, right) => {
    const priorityDelta =
      (STATUS_PRIORITY[right.attributes.status] ?? 0) -
      (STATUS_PRIORITY[left.attributes.status] ?? 0);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.attributes.updated_at).getTime() - new Date(left.attributes.updated_at).getTime();
  });

  const subscription = sortedSubscriptions.at(0);
  if (!subscription) {
    return {
      found: false,
      email: normalizedEmail,
      subscriptionId: null,
      customerId: customer?.id ?? null,
      productName: null,
      variantName: null,
      status: null,
      statusFormatted: null,
      renewsAt: null,
      endsAt: null,
      trialEndsAt: null,
      manageSubscriptionUrl: null,
      customerPortalUrl: null,
      updatePaymentMethodUrl: null,
    };
  }

  const attributes = subscription.attributes;
  return {
    found: true,
    email: normalizedEmail,
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
