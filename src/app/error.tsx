"use client";

import { useEffect } from "react";

export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Nidan]", error);
  }, [error]);

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="card p-6 max-w-md">
        <p className="eyebrow">Something broke</p>
        <h1 className="text-[1.25rem] font-bold tracking-tight mt-1">
          We could not load that
        </h1>
        <p className="text-sm text-[var(--color-ink-2)] mt-2">
          Nothing was lost. Draft case sheets autosave every two seconds, so if
          you were writing one it is safe.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-[var(--color-ink-3)] mt-2">
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center h-10 px-4 rounded-[6px] bg-[var(--color-brand)] text-[var(--color-on-brand)] text-sm font-medium mt-4"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
