import { requirePatient, getLocale } from "@/lib/auth";
import { notificationsFor, patientHeader } from "@/lib/db/store";
import { PatientShell } from "@/components/patient/shell";
import { t } from "@/lib/i18n";
import { initials } from "@/lib/utils";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePatient();
  const locale = await getLocale();
  const p = patientHeader(session.userId)!;

  return (
    <PatientShell
      locale={locale}
      messages={t(locale)}
      user={{
        name: p.full_name,
        mrn: p.mrn,
        initials: initials(p.full_name),
        notifications: notificationsFor(session.userId),
      }}
    >
      {children}
    </PatientShell>
  );
}
