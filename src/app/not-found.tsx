import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="text-center max-w-sm">
        <p className="eyebrow">404</p>
        <h1 className="text-[1.5rem] font-bold tracking-tight mt-1">
          That page is not here
        </h1>
        <p className="text-[var(--color-ink-2)] mt-2">
          It may have moved, or you may not have access to it. Records you cannot
          open look exactly like records that do not exist — that is deliberate.
        </p>
        <Link
          href="/"
          className="inline-flex items-center h-10 px-4 rounded-[6px] bg-[var(--color-brand)] text-[var(--color-on-brand)] text-sm font-medium mt-5"
        >
          Back to the start
        </Link>
      </div>
    </main>
  );
}
