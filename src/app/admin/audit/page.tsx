import { requireAdmin } from "@/lib/auth";
import { listAccessAudit } from "@/lib/db/store";
import { Badge, Empty, SectionTitle, Table, Td, Th, Tr } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

const ACTION_TONE: Record<string, "good" | "warning" | "critical" | "neutral"> = {
  view: "neutral", create: "good", amend: "warning", export: "warning", override: "critical",
};

export default async function AdminAudit() {
  const session = await requireAdmin();
  const rows = listAccessAudit({ id: session.userId, role: "admin" }, { limit: 300 });

  return (
    <div className="max-w-5xl">
      <SectionTitle
        eyebrow="Administration"
        title={
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={19} className="text-[var(--color-ink-3)]" /> Access audit log
          </span>
        }
        action={<span className="text-xs text-[var(--color-ink-3)]">Most recent {rows.length}</span>}
      />
      <p className="text-sm text-[var(--color-ink-3)] mb-3">
        Every clinician read of a patient&apos;s record, in order — the same trail a
        patient sees on their own &ldquo;who has seen my records&rdquo; page.
      </p>
      {rows.length === 0 ? (
        <Empty title="No access events logged yet" body="This fills in as doctors open patient records." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Patient</Th>
              <Th>Action</Th>
              <Th>Resource</Th>
              <Th>Basis</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>{fmtDateTime(r.at)}</Td>
                <Td>{r.actorName} <span className="text-xs text-[var(--color-ink-3)]">({r.actor_role})</span></Td>
                <Td>{r.patientName}</Td>
                <Td><Badge tone={ACTION_TONE[r.action] ?? "neutral"}>{r.action}</Badge></Td>
                <Td className="font-mono text-xs">{r.resource}</Td>
                <Td className="text-xs">{r.basis?.replace("_", " ") ?? "—"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
