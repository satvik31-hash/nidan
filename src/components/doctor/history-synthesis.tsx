"use client";

import { useState, useTransition } from "react";
import { AiLabel, Button, Card } from "@/components/ui";
import { synthesise } from "@/app/actions/doctor";
import { Sparkles } from "lucide-react";

export function HistorySynthesis({
  patientId, visits, reports,
}: { patientId: string; visits: number; reports: number }) {
  const [text, setText] = useState<string | null>(null);
  const [source, setSource] = useState<string>("offline");
  const [pending, start] = useTransition();

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-1.5">
            <Sparkles size={15} className="text-[var(--color-brand)]" />
            Two-year synthesis
          </h3>
          <p className="text-xs text-[var(--color-ink-3)]">
            Across {visits} consultations and {reports} reports — the thing that is
            genuinely impossible on paper.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await synthesise(patientId);
              setText(r.text);
              setSource(r.source);
            })
          }
        >
          {pending ? "Reading the record…" : text ? "Regenerate" : "Summarise this patient"}
        </Button>
      </div>

      {text && (
        <div className="mt-3 pt-3 border-t border-[var(--color-line)]">
          <p className="text-sm whitespace-pre-line">{text}</p>
          <div className="mt-2 flex items-center gap-2">
            <AiLabel source={source} />
            <span className="text-xs text-[var(--color-ink-3)]">
              Nothing here enters the record until you write it yourself.
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
