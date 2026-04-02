import Link from "next/link";

type SuccessPageProps = {
  searchParams: Promise<{
    plan?: string;
  }>;
};

export default async function SuccessPage({
  searchParams,
}: SuccessPageProps) {
  const { plan } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 text-center sm:px-10">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
        Checkout complete
      </p>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Thanks for subscribing
      </h1>
      <p className="mt-6 text-lg leading-8 text-zinc-300">
        Lemon Squeezy will email the receipt and manage the subscription for
        your {plan ?? "selected"} plan. Your webhook endpoint is now the source
        of truth for updating app access.
      </p>
      <div className="mt-10">
        <Link
          href="/"
          className="inline-flex rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
        >
          Back to pricing
        </Link>
      </div>
    </main>
  );
}
