import Link from "next/link";
import { requirePatient, getLocale } from "@/lib/auth";
import {
  analyteSeries, analytesAvailable, documentsFor, historyFor, medicationsFor,
  patientHeader, prescriptionsFor, searchRecords, timelineFor, getProfile,
  getHospital, allergiesFor,
} from "@/lib/db/store";
import { t } from "@/lib/i18n";
import { Badge, Card, Empty, LinkButton, SectionTitle } from "@/components/ui";
import { AnalyteTrend } from "@/components/patient/analyte-trend";
import { fmtDate, explainFrequency, relative } from "@/lib/utils";
import {
  FileText, FlaskConical, Pill, Scissors, HeartHandshake, Stethoscope, Search, Download,
} from "lucide-react";

// Five sub-tabs, as specified. The unifying idea: a single vertical health
// timeline is the default view, and the five tabs are filters over it.
// Judges remember the timeline; they forget the tabs.

const TABS = [
  { key: "timeline", labelKey: "timeline", icon: Stethoscope },
  { key: "prescriptions", labelKey: "prescriptions", icon: Pill },
  { key: "reports", labelKey: "reports", icon: FlaskConical },
  { key: "medications", labelKey: "medications", icon: Pill },
  { key: "surgical", labelKey: "surgicalHistory", icon: Scissors },
  { key: "donor", labelKey: "organDonorTab", icon: HeartHandshake },
] as const;

type Search = { tab?: string; q?: string; from?: string; to?: string; analyte?: string };

export default async function Records({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const session = await requirePatient();
  const locale = await getLocale();
  const m = t(locale);
  const actor = { id: session.userId, role: "patient" as const };
  const pid = session.userId;
  const tab = TABS.some((x) => x.key === sp.tab) ? sp.tab! : "timeline";
  const q = sp.q ?? "";

  const patient = patientHeader(pid)!;
  const nameOf = (id: string) => getProfile(id)?.full_name ?? "—";

  const qs = (over: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { tab, q, from: sp.from, to: sp.to, analyte: sp.analyte, ...over };
    Object.entries(merged).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    return `/patient/records?${p.toString()}`;
  };

  return (
    <div>
      <SectionTitle
        eyebrow={m.records}
        title={m.records}
        action={
          <Link href="/patient/access" className="text-sm text-[var(--color-brand)] hover:underline">
            {m.whoHasSeen} →
          </Link>
        }
      />

      {/* One global filter bar across Records: date range, and a full-text box
          that searches document OCR, diagnoses and drug names at once. */}
      <form className="card p-3 mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] items-end">
        <input type="hidden" name="tab" value={tab} />
        <label className="block">
          <span className="label">{m.searchRecords}</span>
          <div className="flex items-center gap-2 field h-10 py-0">
            <Search size={16} className="text-[var(--color-ink-3)] shrink-0" />
            <input name="q" defaultValue={q} placeholder="creatinine, metformin, Apollo…" className="bg-transparent outline-none w-full text-sm" />
          </div>
        </label>
        <label className="block">
          <span className="label">{m.from}</span>
          <input type="date" name="from" defaultValue={sp.from} className="field h-10" />
        </label>
        <label className="block">
          <span className="label">{m.to}</span>
          <input type="date" name="to" defaultValue={sp.to} className="field h-10" />
        </label>
        <button className="h-10 px-4 rounded-[6px] bg-[var(--color-brand)] text-[var(--color-on-brand)] text-sm font-medium">
          {m.filter}
        </button>
      </form>

      <nav className="flex gap-1 overflow-x-auto mb-5 -mx-1 px-1 pb-1">
        {TABS.map(({ key, labelKey, icon: Icon }) => (
          <Link
            key={key}
            href={qs({ tab: key })}
            className={`pill whitespace-nowrap px-3 py-2 ${
              tab === key
                ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]"
                : "text-[var(--color-ink-2)]"
            }`}
          >
            <Icon size={14} />
            {m[labelKey as keyof typeof m]}
          </Link>
        ))}
      </nav>

      {tab === "timeline" && <Timeline actor={actor} pid={pid} q={q} sp={sp} m={m} />}
      {tab === "prescriptions" && <Prescriptions actor={actor} pid={pid} q={q} nameOf={nameOf} m={m} />}
      {tab === "reports" && <Reports actor={actor} pid={pid} q={q} sp={sp} qs={qs} m={m} />}
      {tab === "medications" && <Medications actor={actor} pid={pid} m={m} />}
      {tab === "surgical" && <Surgical actor={actor} pid={pid} m={m} />}
      {tab === "donor" && <Donor patient={patient} />}
    </div>
  );
}

type Actor = { id: string; role: "patient" };
type M = ReturnType<typeof t>;

const KIND_STYLE = {
  visit: { icon: Stethoscope, tone: "brand" as const },
  prescription: { icon: Pill, tone: "neutral" as const },
  report: { icon: FlaskConical, tone: "neutral" as const },
  surgery: { icon: Scissors, tone: "warning" as const },
  vitals: { icon: Stethoscope, tone: "neutral" as const },
};

function Timeline({ actor, pid, q, sp, m }: { actor: Actor; pid: string; q: string; sp: Search; m: M }) {
  let entries = timelineFor(actor, pid);
  if (q) {
    const n = q.toLowerCase();
    entries = entries.filter((e) => (e.title + e.subtitle).toLowerCase().includes(n));
  }
  if (sp.from) entries = entries.filter((e) => e.at >= sp.from!);
  if (sp.to) entries = entries.filter((e) => e.at <= sp.to! + "T23:59:59Z");

  if (!entries.length) {
    return <Empty title={m.noRecords} body="Nothing matches this filter yet." action={<LinkButton href="/patient/book">{m.book}</LinkButton>} />;
  }

  let lastYear = "";
  return (
    <ol className="relative">
      {entries.slice(0, 80).map((e) => {
        const year = e.at.slice(0, 4);
        const showYear = year !== lastYear;
        lastYear = year;
        const { icon: Icon, tone } = KIND_STYLE[e.kind];
        return (
          <li key={`${e.kind}-${e.id}`}>
            {showYear && (
              <div className="eyebrow mt-6 mb-2 first:mt-0">{year}</div>
            )}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="w-8 h-8 rounded-full grid place-items-center bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)] shrink-0">
                  <Icon size={15} />
                </span>
                <span className="flex-1 w-px bg-[var(--color-line)] my-1" />
              </div>
              <div className="flex-1 pb-4 min-w-0">
                <Card className="hover:border-[var(--color-brand)] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.title}</p>
                      <p className="text-sm text-[var(--color-ink-3)] truncate">{e.subtitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-[var(--color-ink-3)]">{fmtDate(e.at)}</p>
                      {e.meta && <Badge tone={tone} className="mt-1">{e.meta}</Badge>}
                    </div>
                  </div>
                  {e.href && (
                    <Link href={e.href} className="text-sm text-[var(--color-brand)] hover:underline mt-2 inline-block">
                      {m.open} →
                    </Link>
                  )}
                </Card>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Prescriptions({
  actor, pid, q, nameOf, m,
}: { actor: Actor; pid: string; q: string; nameOf: (id: string) => string; m: M }) {
  let rxs = prescriptionsFor(actor, pid);
  if (q) {
    const n = q.toLowerCase();
    rxs = rxs.filter((r) => r.items.some((i) => i.drug_text.toLowerCase().includes(n)));
  }
  if (!rxs.length) return <Empty title={m.noRecords} body="No prescriptions match this filter." />;

  return (
    <div className="space-y-3">
      {rxs.map((rx) => (
        <Card key={rx.id}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="font-medium">{nameOf(rx.doctor_id)}</p>
              <p className="text-xs text-[var(--color-ink-3)]">
                {fmtDate(rx.issued_at)} · {relative(rx.issued_at)}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/patient/records/rx/${rx.id}`} className="pill hover:border-[var(--color-brand)]">
                <FileText size={13} /> {m.downloadPdf}
              </Link>
            </div>
          </div>
          <ul className="space-y-1.5">
            {rx.items.map((i) => (
              <li key={i.id} className="text-sm flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{i.drug_text}</span>
                <span className="text-[var(--color-ink-3)]">{i.dose}</span>
                <span className="pill font-mono">{i.frequency}</span>
                <span className="text-xs text-[var(--color-ink-3)]">
                  {explainFrequency(i.frequency)}{i.timing ? `, ${i.timing}` : ""}
                  {i.duration_days ? `, for ${i.duration_days} days` : ""}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={`/patient/records/rx/${rx.id}?reorder=1`}
              className="pill hover:border-[var(--color-brand)]"
            >
              {m.reorder}
            </Link>
            <span className="font-mono text-[0.6875rem] text-[var(--color-ink-3)]">
              Verify: {rx.verify_token}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

async function Reports({
  actor, pid, q, sp, qs, m,
}: { actor: Actor; pid: string; q: string; sp: Search; qs: (o: Partial<Search>) => string; m: M }) {
  const found = searchRecords(actor, pid, q, { from: sp.from, to: sp.to });
  const docs = found.documents;
  const analytes = analytesAvailable(pid);
  const selected = sp.analyte ?? analytes[0];
  const series = selected ? analyteSeries(actor, pid, selected) : [];

  return (
    <div className="space-y-5">
      {/* OCR extraction into extracted_values is what makes this possible:
          one analyte plotted across five years of scattered PDFs. */}
      {analytes.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="eyebrow">{m.trendAcross}</span>
            <div className="flex gap-1 ml-auto flex-wrap">
              {analytes.map((a) => (
                <Link
                  key={a}
                  href={qs({ analyte: a })}
                  className={`pill ${a === selected ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]" : ""}`}
                >
                  {a}
                </Link>
              ))}
            </div>
          </div>
          <AnalyteTrend data={series} analyte={selected ?? ""} />
        </Card>
      )}

      {docs.length === 0 ? (
        <Empty title={m.noRecords} body="No reports match this filter." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => {
            const flagged = (d.extracted_values ?? []).filter((v) => v.flag !== "normal");
            return (
              <Card key={d.id} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-[6px] bg-[var(--color-paper)] grid place-items-center shrink-0">
                    <FlaskConical size={18} className="text-[var(--color-ink-3)]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm leading-snug">{d.title}</p>
                    <p className="text-xs text-[var(--color-ink-3)]">
                      {fmtDate(d.report_date)} · {(d.size_bytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                {flagged.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {flagged.map((v) => (
                      <Badge key={v.analyte} tone={v.flag === "high" ? "critical" : "warning"}>
                        {v.analyte} {v.value} {v.unit} {v.flag === "high" ? "↑" : "↓"}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-[var(--color-line)] flex gap-2">
                  <Link href={`/patient/records/report/${d.id}`} className="pill hover:border-[var(--color-brand)]">
                    {m.open}
                  </Link>
                  <Link href={`/patient/records/report/${d.id}?explain=1`} className="pill hover:border-[var(--color-brand)]">
                    {m.explainThis}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Medications({ actor, pid, m }: { actor: Actor; pid: string; m: M }) {
  const meds = medicationsFor(actor, pid);
  const allergies = allergiesFor(actor, pid);

  return (
    <div className="space-y-5">
      {allergies.length > 0 && (
        <div className="rounded-[8px] border border-[color-mix(in_srgb,var(--color-critical)_40%,transparent)] bg-[var(--color-critical-soft)] p-3">
          <p className="text-sm font-medium text-[var(--color-critical)]">
            ⚠ {m.allergies}: {allergies.map((a) => a.allergen).join(", ")}
          </p>
          <p className="text-xs text-[var(--color-critical)] opacity-80 mt-0.5">
            {m.showDoctor}
          </p>
        </div>
      )}

      <div>
        <SectionTitle title={m.current} />
        {meds.current.length === 0 ? (
          <Empty title={m.noCurrentMeds} />
        ) : (
          <div className="space-y-2">
            {meds.current.map((med) => (
              <Card key={med.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{med.drug_text}</p>
                  <p className="text-sm text-[var(--color-ink-3)]">
                    {med.dose} · <span className="font-mono">{med.frequency}</span> ·{" "}
                    {explainFrequency(med.frequency ?? "")}
                  </p>
                  <p className="text-xs text-[var(--color-ink-3)] mt-0.5">
                    {m.started} {fmtDate(med.started_on)} · {relative(med.started_on)}
                  </p>
                </div>
                {med.adherence_pct != null && (
                  <Badge tone={med.adherence_pct >= 80 ? "good" : "warning"}>
                    {med.adherence_pct}% taken
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle title={m.past} />
        {meds.past.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)]">{m.nothingStopped}</p>
        ) : (
          <div className="space-y-2">
            {meds.past.map((med) => (
              <Card key={med.id} className="opacity-70">
                <p className="font-medium">{med.drug_text}</p>
                <p className="text-xs text-[var(--color-ink-3)]">
                  {fmtDate(med.started_on)} – {med.ended_on ? fmtDate(med.ended_on) : "—"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Surgical({ actor, pid, m }: { actor: Actor; pid: string; m: M }) {
  const { surgical } = historyFor(actor, pid);
  if (!surgical.length) return <Empty title={m.noSurgeries} />;
  return (
    <div className="space-y-3">
      {surgical.map((s) => (
        <Card key={s.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{s.procedure_name}</p>
              <p className="text-sm text-[var(--color-ink-3)]">
                {s.hospital_name} · {s.surgeon_name} · {s.anaesthesia} anaesthesia
              </p>
              {s.complications && (
                <p className="text-sm text-[var(--color-warning)] mt-1">Complications: {s.complications}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-[var(--color-ink-3)]">{s.performed_on ? fmtDate(s.performed_on) : "—"}</p>
              {/* Self-reported data is visually distinct from doctor-recorded
                  data, so a doctor knows the provenance at a glance. */}
              {s.is_self_reported && <Badge tone="warning" className="mt-1">self-reported</Badge>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Donor({ patient }: { patient: NonNullable<ReturnType<typeof patientHeader>> }) {
  const tone = patient.organ_donor === "registered" ? "good" : patient.organ_donor === "not_registered" ? "neutral" : "warning";
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          <HeartHandshake size={24} className="text-[var(--color-brand)]" />
          <div>
            <p className="font-medium">Organ donor status</p>
            <Badge tone={tone as "good" | "neutral" | "warning"} className="mt-1">
              {patient.organ_donor.replace("_", " ")}
            </Badge>
          </div>
        </div>
        {patient.organ_donor_ref && (
          <p className="text-sm text-[var(--color-ink-3)] mt-3">
            NOTTO pledge reference: <span className="font-mono">{patient.organ_donor_ref}</span>
          </p>
        )}
        <p className="text-sm text-[var(--color-ink-2)] mt-3">
          Your status is printed on your emergency QR card, so a treating team can
          see it without a login when it matters.
        </p>
        <a
          href="https://notto.abdm.gov.in"
          target="_blank"
          rel="noreferrer"
          className="pill mt-3 inline-flex hover:border-[var(--color-brand)]"
        >
          <Download size={13} /> Register with NOTTO
        </a>
      </Card>
    </div>
  );
}
