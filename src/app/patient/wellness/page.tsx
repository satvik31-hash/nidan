import { getLocale, requirePatient } from "@/lib/auth";
import { checkinsFor, readingsFor } from "@/lib/db/store";
import { t } from "@/lib/i18n";
import { SectionTitle } from "@/components/ui";
import { WellnessView } from "@/components/patient/wellness-view";

export default async function Wellness() {
  const session = await requirePatient();
  const locale = await getLocale();
  const m = t(locale);
  const actor = { id: session.userId, role: "patient" as const };

  const checkins = checkinsFor(actor, session.userId);
  const readings = readingsFor(actor, session.userId);

  const today = new Date().toISOString().slice(0, 10);
  const todays = checkins.find((c) => c.log_date === today) ?? null;

  // Streak: consecutive days ending today or yesterday
  let streak = 0;
  const dates = new Set(checkins.map((c) => c.log_date));
  const cursor = new Date();
  if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const metric = (name: string) =>
    readings
      .filter((r) => r.metric === name)
      .map((r) => ({ date: r.measured_at.slice(0, 10), v: Number(r.value) }))
      .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <SectionTitle eyebrow="Wellness" title={m.wellness} />
      <WellnessView
        today={todays}
        streak={streak}
        heatmap={checkins.slice(0, 30).map((c) => ({
          date: c.log_date, mood: c.mood, pain: c.pain_score,
        }))}
        series={{
          steps: metric("steps"),
          heart_rate: metric("heart_rate"),
          sleep_minutes: metric("sleep_minutes"),
          spo2: metric("spo2"),
        }}
        connected={readings.length > 0}
        m={{
          dailyCheckin: m.dailyCheckin, deviceSync: m.deviceSync, mood: m.mood,
          energy: m.energy, sleep: m.sleep, pain: m.pain, symptoms: m.symptoms,
          tookMedicines: m.tookMedicines, water: m.water, saveCheckin: m.saveCheckin,
          streak: m.streak, steps: m.steps, restingHeartRate: m.restingHeartRate,
          saved: m.saved, yes: m.yes, no: m.no,
        }}
      />
    </div>
  );
}
