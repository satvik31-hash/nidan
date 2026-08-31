import { getLocale, requirePatient } from "@/lib/auth";
import { auditFor, grantsFor, pendingRequestsFor } from "@/lib/db/store";
import { t } from "@/lib/i18n";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui";
import { RevokeButton, ApproveRequest } from "@/components/patient/access-controls";
import { fmtDateTime, relative } from "@/lib/utils";
import { Eye, ShieldAlert } from "lucide-react";

// "Who has seen my records", reading straight from access_audit, with a
// revoke button per doctor. Few teams build this. It is the credibility
// feature — and under the DPDP Act 2023 a working revoke button is not a
// nicety, it is the obligation.

const BASIS_LABEL: Record<string, string> = {
  appointment: "You booked an appointment",
  patient_consent: "You approved an OTP request",
  emergency_override: "Emergency break-glass",
  referral: "Referred by another doctor",
};

export default async function AccessLog() {
  const session = await requirePatient();
  const locale = await getLocale();
  const m = t(locale);

  const grants = grantsFor(session.userId);
  const audit = auditFor(session.userId);
  const pending = pendingRequestsFor(session.userId);

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Consent"
        title={m.whoHasSeen}
        action={
          <span className="text-xs text-[var(--color-ink-3)] max-w-[220px] text-right hidden sm:block">
            Under the DPDP Act 2023 your health data is sensitive personal data.
            You can withdraw access at any time.
          </span>
        }
      />

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((r) => (
            <ApproveRequest
              key={r.id}
              id={r.id}
              doctorName={r.doctor?.full_name ?? "A doctor"}
              speciality={r.doctor?.specialization ?? ""}
              labels={{ requested: m.accessRequested, approve: m.approve, deny: m.deny }}
            />
          ))}
        </div>
      )}

      <section>
        <h3 className="font-semibold mb-3">Doctors with access</h3>
        {grants.length === 0 ? (
          <Empty title="Nobody has access to your records." />
        ) : (
          <div className="space-y-3">
            {grants.map((g) => (
              <Card key={g.id} className={g.active ? "" : "opacity-60"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium flex items-center gap-2">
                      {g.doctor?.full_name ?? "Unknown doctor"}
                      {g.basis === "emergency_override" && (
                        <Badge tone="critical" icon={<ShieldAlert size={11} />}>break-glass</Badge>
                      )}
                    </p>
                    <p className="text-sm text-[var(--color-ink-3)]">
                      {g.doctor?.specialization}
                      {g.doctor?.hospitals[0] ? ` · ${g.doctor.hospitals[0].name}` : ""}
                    </p>
                    <p className="text-xs text-[var(--color-ink-3)] mt-1">
                      {m.grantedBy}: {BASIS_LABEL[g.basis]} · {relative(g.granted_at)}
                    </p>
                    <p className="text-xs text-[var(--color-ink-3)]">
                      Can see: {g.scope.join(", ")}
                    </p>
                    <p className="text-xs text-[var(--color-ink-2)] mt-1 flex items-center gap-1">
                      <Eye size={11} /> opened your record {g.views} time{g.views === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {g.revoked_at ? (
                      <Badge tone="neutral">{m.revoked}</Badge>
                    ) : g.active ? (
                      <>
                        <Badge tone="good">{m.active}</Badge>
                        <p className="text-xs text-[var(--color-ink-3)] mt-1">
                          {m.expires} {relative(g.expires_at)}
                        </p>
                        <RevokeButton id={g.id} label={m.revoke} doctor={g.doctor?.full_name ?? ""} />
                      </>
                    ) : (
                      <Badge tone="warning">expired</Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-semibold mb-3">Every access, logged</h3>
        {audit.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-ink-3)]">
              Nobody has opened your record in this session yet. Every read is written
              here the moment it happens.
            </p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-[var(--color-line)]">
                    {["When", "Who", "Did what", "Resource", "Because"].map((h) => (
                      <th key={h} className="px-3 py-2 eyebrow font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.slice(0, 40).map((a) => (
                    <tr key={a.id} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-[var(--color-ink-3)]">
                        {fmtDateTime(a.at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {grants.find((g) => g.doctor_id === a.actor_id)?.doctor?.full_name ?? a.actor_id.slice(0, 12)}
                      </td>
                      <td className="px-3 py-2">{a.action}</td>
                      <td className="px-3 py-2 font-mono text-xs">{a.resource}</td>
                      <td className="px-3 py-2">
                        {a.basis === "emergency_override" ? (
                          <Badge tone="critical">break-glass</Badge>
                        ) : (
                          <span className="text-xs text-[var(--color-ink-3)]">
                            {BASIS_LABEL[a.basis ?? ""] ?? "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
