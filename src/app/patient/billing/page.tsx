import { getLocale, requirePatient } from "@/lib/auth";
import { billsFor, getHospital, policiesFor } from "@/lib/db/store";
import { t } from "@/lib/i18n";
import { SectionTitle } from "@/components/ui";
import { BillingView } from "@/components/patient/billing-view";

// Three stacked zones. Every figure is derived by aggregate, never computed
// in the client — the component receives totals, not raw arithmetic to do.

export default async function Billing() {
  const session = await requirePatient();
  const locale = await getLocale();
  const m = t(locale);
  const actor = { id: session.userId, role: "patient" as const };

  const bills = billsFor(actor, session.userId);
  const policies = policiesFor(actor, session.userId);

  const years = [...new Set(bills.map((b) => b.billed_on.slice(0, 4)))].sort().reverse();

  const rows = bills.map((b) => ({
    id: b.id,
    bill_no: b.bill_no,
    date: b.billed_on,
    hospital: getHospital(b.hospital_id)?.name ?? "—",
    total: b.total,
    covered: b.insurance_covered,
    payable: b.patient_payable,
    status: b.status,
    items: b.items.map((i) => ({ category: i.category, description: i.description, amount: i.amount })),
  }));

  // Lifetime totals
  const totalBilled = bills.reduce((a, b) => a + b.total, 0);
  const covered = bills.reduce((a, b) => a + b.insurance_covered, 0);

  // Cumulative split between hospital services and medication
  const byDate = [...bills].sort((a, b) => a.billed_on.localeCompare(b.billed_on));
  let hosp = 0, med = 0;
  const cumulative = byDate.map((b) => {
    const pharmacy = b.items.filter((i) => i.category === "pharmacy").reduce((a, i) => a + i.amount, 0);
    med += pharmacy;
    hosp += b.total - pharmacy;
    return { date: b.billed_on.slice(0, 7), hospital: Math.round(hosp), medication: Math.round(med) };
  });

  return (
    <div>
      <SectionTitle eyebrow="Billing" title={m.billing} />
      <BillingView
        years={years}
        rows={rows}
        lifetime={{ billed: totalBilled, covered, outOfPocket: totalBilled - covered }}
        cumulative={cumulative}
        policies={policies.map((p) => ({
          id: p.id, insurer: p.insurer, policy_no: p.policy_no, scheme: p.scheme,
          sum_insured: p.sum_insured, valid_to: p.valid_to, tpa_name: p.tpa_name,
          tpa_phone: p.tpa_phone, used: p.used,
        }))}
        m={{
          lifetimeSpending: m.lifetimeSpending, totalBilled: m.totalBilled,
          insuranceCovered: m.insuranceCovered, outOfPocket: m.outOfPocket,
          insurance: m.insurance, sumInsured: m.sumInsured, utilised: m.utilised,
          exportCsv: m.exportCsv, paid: m.paid, unpaid: m.unpaid,
        }}
      />
    </div>
  );
}
