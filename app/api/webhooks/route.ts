import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export async function POST(request: NextRequest) {
  const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature") ?? "";
  if (!rawBody || !signature) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
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
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const payload = JSON.parse(rawBody);

  console.info("Lemon Squeezy webhook", {
    event: payload?.meta?.event_name ?? "unknown",
    id: payload?.data?.id ?? "unknown",
  });

  return NextResponse.json({ ok: true });
}
