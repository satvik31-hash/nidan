import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, requirePatient } from "@/lib/auth";
import { documentsFor, getProfile } from "@/lib/db/store";
import { explainReport } from "@/lib/ai";
import { AiLabel, Badge, Card, SectionTitle } from "@/components/ui";
import { ReadAloudButton } from "@/components/patient/read-aloud-button";
import { LOCALE_TAGS } from "@/lib/i18n";
import { fmtDate } from "@/lib/utils";
import { ArrowLeft, FileText } from "lucide-react";

export default async function ReportPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ explain?: string }> }) {
  const { id } = await params;
  const { explain } = await searchParams;
  const session = await requirePatient();
  const locale = await getLocale();
  const actor = { id: session.userId, role: "patient" as const };

  const doc = documentsFor(actor, session.userId).find((d) => d.id === id);
  if (!doc) notFound();

  // Cached server-side; the demo reads the cache, so a network blip on the
  // Claude call is invisible and the offline template always renders.
  const explanation = explain ? await explainReport(doc, locale) : null;

  return (
    <div className="space-y-4">
      <Link href="/patient/records?tab=reports" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-2)] hover:text-[var(--color-brand)]">
        <ArrowLeft size={16} /> Back to reports
      </Link>

      <SectionTitle eyebrow={fmtDate(doc.report_date)} title={doc.title} />

      {doc.extracted_values && doc.extracted_values.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[var(--color-line)]">
                  {["Test", "Result", "Reference range", ""].map((h) => (
                    <th key={h} className="px-3 py-2 eyebrow font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doc.extracted_values.map((v) => (
                  <tr key={v.analyte} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-3 py-2.5">{v.analyte}</td>
                    <td className="px-3 py-2.5 font-semibold">
                      {v.value} <span className="font-normal text-[var(--color-ink-3)]">{v.unit}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-ink-3)]">{v.ref} {v.unit}</td>
                    <td className="px-3 py-2.5">
                      {v.flag === "normal" ? (
                        <Badge tone="good">normal</Badge>
                      ) : (
                        <Badge tone={v.flag === "high" ? "critical" : "warning"}>
                          {v.flag === "high" ? "↑ high" : "↓ low"}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-xs text-[var(--color-ink-3)] border-t border-[var(--color-line)]">
            These values were extracted from the uploaded PDF by OCR, which is what
            lets them be plotted over time.
          </p>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="font-semibold">What this means</h3>
          {!explanation && (
            <Link href={`/patient/records/report/${doc.id}?explain=1`} className="pill hover:border-[var(--color-brand)]">
              Explain this report
            </Link>
          )}
        </div>
        {explanation ? (
          <>
            <p className="text-[0.9375rem] whitespace-pre-line">{explanation.text}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <AiLabel source={explanation.source} />
              <ReadAloudButton text={explanation.text} lang={LOCALE_TAGS[locale]} />
            </div>
            <p className="text-xs text-[var(--color-ink-3)] mt-2">
              This is background information, not a diagnosis. It has not been
              reviewed by your doctor.
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--color-ink-3)]">
            Ask for a plain-language explanation of each flagged value, in English
            or Hindi.
          </p>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-2">
          <FileText size={16} className="text-[var(--color-ink-3)]" />
          <h3 className="font-semibold">The original document</h3>
        </div>
        <p className="text-sm text-[var(--color-ink-3)]">
          {doc.mime_type} · {(doc.size_bytes / 1024).toFixed(0)} KB
          {doc.ordering_doctor && ` · ordered by ${getProfile(doc.ordering_doctor)?.full_name}`}
        </p>
        {/* Storage objects are private. A signed URL with a 60-second TTL is
            generated server-side after the same access check, never a public
            bucket path. */}
        <p className="text-xs text-[var(--color-ink-3)] mt-2">
          Served through a signed link valid for 60 seconds, generated after an
          access check. The bucket itself is private.
        </p>
        <a
          href={`/api/documents/${doc.id}/url`}
          className="pill mt-3 inline-flex hover:border-[var(--color-brand)]"
        >
          Open the PDF
        </a>
        {doc.ocr_text && (
          <details className="mt-3">
            <summary className="text-sm cursor-pointer text-[var(--color-ink-2)]">
              Searchable text extracted from this report
            </summary>
            <p className="text-sm text-[var(--color-ink-3)] mt-2">{doc.ocr_text}</p>
          </details>
        )}
      </Card>
    </div>
  );
}
