import { NextRequest, NextResponse } from "next/server";
import { createCheckoutUrl, isPlanKey } from "@/lib/lemon-squeezy";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    plan?: string;
    email?: string;
  } | null;

  const plan = body?.plan;
  if (!isPlanKey(plan)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  try {
    const url = await createCheckoutUrl(plan, request.nextUrl.origin, body?.email?.trim() || undefined);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 500 },
    );
  }
}
