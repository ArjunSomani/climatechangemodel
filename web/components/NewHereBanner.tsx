import Link from "next/link";

export function NewHereBanner() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      New here?{" "}
      <Link href="/how-it-works" className="underline">
        How it works
      </Link>{" "}
      explains what all this means, with pictures and no jargon.
    </div>
  );
}
