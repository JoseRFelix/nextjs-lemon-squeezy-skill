import { NextRequest, NextResponse } from "next/server";
import { recoverSubscription } from "@/lib/lemon-squeezy";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await recoverSubscription(email));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lookup failed." },
      { status: 500 },
    );
  }
}
