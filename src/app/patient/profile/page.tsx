import Link from "next/link";
import { getLocale, requirePatient } from "@/lib/auth";
import { contactsFor, emergencyCardFor, patientHeader } from "@/lib/db/store";
import { t } from "@/lib/i18n";
import { Badge, Card, KeyValue, SectionTitle } from "@/components/ui";
import { InlineField } from "@/components/patient/inline-field";
import { CompletenessRing } from "@/components/patient/completeness-ring";
import { updateProfile } from "@/app/actions/patient";
import { ageString, fmtDate } from "@/lib/utils";
import { IdCard, Phone, ShieldCheck } from "lucide-react";

// Everything is inline-editable — click the field, edit, blur to save.
// No "Edit Profile" mode. Changing phone or ABHA re-triggers OTP
// verification, which is why those two are not inline.

export default async function ProfilePage() {
  const session = await requirePatient();
  const locale = await getLocale();
  const m = t(locale);
  const p = patientHeader(session.userId)!;
  const contacts = contactsFor(session.userId);
  const card = emergencyCardFor(session.userId);

  const fields = [
    ["full_name", p.full_name], ["date_of_birth", p.date_of_birth], ["sex", p.sex],
    ["blood_group", p.blood_group !== "unknown" ? p.blood_group : null],
    ["height_cm", p.height_cm], ["abha_number", p.abha_number],
    ["address_line1", p.address_line1], ["pincode", p.pincode],
    ["email", p.email], ["emergency_contact", contacts.length ? "yes" : null],
  ] as const;
  const missing = fields.filter(([, v]) => !v).map(([k]) => k);
  const pct = Math.round(((fields.length - missing.length) / fields.length) * 100);
  const LABELS: Record<string, string> = {
    blood_group: "your blood group", height_cm: "your height",
    abha_number: "your ABHA number", address_line1: "your address",
    pincode: "your PIN code", email: "your email",
    emergency_contact: "an emergency contact",
  };

  return (
    <div className="space-y-5">
      <SectionTitle eyebrow="Profile" title={m.profile} />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <IdCard size={16} className="text-[var(--color-ink-3)]" />
              <h3 className="font-semibold">{m.identity}</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6">
              <InlineField
                name="full_name" label={m.fullName} value={p.full_name} action={updateProfile}
              />
              <div className="py-2 border-b border-[var(--color-line)]">
                <span className="label">{m.dateOfBirth}</span>
                <p className="text-sm">
                  {fmtDate(p.date_of_birth)}{" "}
                  <span className="text-[var(--color-ink-3)]">· {m.age} {ageString(p.date_of_birth)}</span>
                </p>
              </div>
              <InlineField
                name="blood_group" label={m.bloodGroup} value={p.blood_group} action={updateProfile}
                options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]}
              />
              <InlineField
                name="height_cm" label="Height (cm)" value={String(p.height_cm ?? "")} action={updateProfile} type="number"
              />
              <div className="py-2 border-b border-[var(--color-line)]">
                <span className="label">{m.mrn}</span>
                <p className="font-mono text-sm">{p.mrn}</p>
              </div>
              <div className="py-2 border-b border-[var(--color-line)]">
                <span className="label">{m.abha}</span>
                <p className="font-mono text-sm">
                  {p.abha_number ?? <Link href="/patient/profile/abha" className="text-[var(--color-brand)] underline font-sans">Link your ABHA →</Link>}
                </p>
                {p.abha_address && <p className="text-xs text-[var(--color-ink-3)]">{p.abha_address}</p>}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Phone size={16} className="text-[var(--color-ink-3)]" />
              <h3 className="font-semibold">{m.contact}</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6">
              <div className="py-2 border-b border-[var(--color-line)]">
                <span className="label">Primary phone</span>
                <p className="text-sm flex items-center gap-1.5">
                  {p.phone}
                  <Badge tone="good" icon={<ShieldCheck size={12} />}>verified</Badge>
                </p>
                <p className="text-xs text-[var(--color-ink-3)] mt-0.5">
                  Changing this re-triggers OTP verification.
                </p>
              </div>
              <InlineField name="email" label={m.email} value={p.email ?? ""} action={updateProfile} type="email" />
              <InlineField name="address_line1" label={m.address} value={p.address_line1 ?? ""} action={updateProfile} className="sm:col-span-2" />
              <InlineField name="city" label="City" value={p.city ?? ""} action={updateProfile} />
              <InlineField name="pincode" label="PIN code" value={p.pincode ?? ""} action={updateProfile} />
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">{m.emergencyContacts}</h3>
            {contacts.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-3)]">None added yet.</p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{c.name}</span>{" "}
                      <span className="text-[var(--color-ink-3)]">· {c.relation}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <a href={`tel:${c.phone}`} className="font-mono text-[var(--color-brand)]">{c.phone}</a>
                      {c.is_primary && <Badge tone="brand">primary</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* A circular meter with the next missing field named. Drives data
              quality without nagging. */}
          <Card>
            <div className="flex items-center gap-4">
              <CompletenessRing pct={pct} />
              <div>
                <p className="font-medium text-sm">{m.profileComplete}</p>
                <p className="text-xs text-[var(--color-ink-3)]">
                  {missing.length
                    ? `${m.nextMissing} ${LABELS[missing[0]] ?? missing[0]}`
                    : "Nothing missing. Thank you."}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-sm mb-1">{m.healthIdCard}</h3>
            <p className="text-xs text-[var(--color-ink-3)] mb-3">
              Photo, MRN, blood group, allergies and the emergency QR — printable,
              and readable without a login.
            </p>
            <Link
              href="/patient/card"
              className="inline-flex items-center justify-center h-10 px-4 rounded-[6px] bg-[var(--color-brand)] text-[var(--color-on-brand)] text-sm font-medium w-full"
            >
              {m.downloadCard}
            </Link>
            {card && (
              <p className="font-mono text-[0.6875rem] text-[var(--color-ink-3)] mt-2 text-center">
                {card.token}
              </p>
            )}
          </Card>

          <Card>
            <KeyValue k={m.organDonor} v={<span className="capitalize">{p.organ_donor.replace("_", " ")}</span>} />
            <KeyValue k="Records visible to" v={<Link href="/patient/access" className="text-[var(--color-brand)] underline">{m.whoHasSeen}</Link>} />
          </Card>
        </div>
      </div>
    </div>
  );
}
