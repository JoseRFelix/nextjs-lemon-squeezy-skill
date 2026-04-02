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
