import { getLocale, requirePatient } from "@/lib/auth";
import { listDoctors, listHospitals, listSpecializations } from "@/lib/db/store";
import { t } from "@/lib/i18n";
import { SectionTitle } from "@/components/ui";
import { BookingWizard } from "@/components/patient/booking-wizard";

export default async function BookPage({
  searchParams,
}: { searchParams: Promise<{ doctor?: string; hospital?: string }> }) {
  const sp = await searchParams;
  await requirePatient();
  const locale = await getLocale();
  const m = t(locale);

  const hospitals = listHospitals();
  const doctors = listDoctors().map((d) => ({
    id: d.id,
    full_name: d.full_name,
    specialization: d.specialization,
    specialization_id: d.specialization_id,
    qualifications: d.qualifications,
    experience_years: d.experience_years,
    languages: d.languages,
    consultation_fee: d.consultation_fee,
    verified: !!d.verified_at,
    hospitalIds: d.hospitals.map((h) => h.id),
  }));

  return (
    <div>
      <SectionTitle eyebrow="Book" title={m.book} />
      <BookingWizard
        hospitals={hospitals.map((h) => ({
          id: h.id, name: h.name, city: h.city, address: h.address,
          lat: h.lat, lng: h.lng,
        }))}
        doctors={doctors}
        specializations={listSpecializations()}
        preselect={{ doctorId: sp.doctor, hospitalId: sp.hospital }}
        m={{
          chooseHospital: m.chooseHospital, chooseDoctor: m.chooseDoctor,
          chooseTime: m.chooseTime, confirm: m.confirm, nearMe: m.nearMe,
          notSureSpeciality: m.notSureSpeciality, reasonForVisit: m.reasonForVisit,
          consultationFee: m.consultationFee, morning: m.morning,
          afternoon: m.afternoon, evening: m.evening, consentLine: m.consentLine,
          confirmBooking: m.confirmBooking, slotGone: m.slotGone,
          back: m.back, next: m.next,
        }}
      />
    </div>
  );
}
