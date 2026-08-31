// Clinical reference data and the small pieces of clinical logic the UI
// leans on: vital normal ranges, an offline ICD-11 index, drug-interaction
// and allergy checking, and the "within normal limits" boilerplate.

import { drugAllergenMap, drugMaster } from "@/lib/db/seed";
import type { Allergy, Drug, Vitals } from "@/lib/types";

// ── Vitals: live range flagging ───────────────────────────────
export type Flag = "low" | "normal" | "high";

interface Range { low: number; high: number; unit: string; label: string }

export const VITAL_RANGES: Record<string, Range> = {
  temperature_c: { low: 36.1, high: 37.5, unit: "°C", label: "Temperature" },
  pulse_bpm: { low: 60, high: 100, unit: "bpm", label: "Pulse" },
  resp_rate: { low: 12, high: 20, unit: "/min", label: "Respiratory rate" },
  bp_systolic: { low: 90, high: 139, unit: "mmHg", label: "BP systolic" },
  bp_diastolic: { low: 60, high: 89, unit: "mmHg", label: "BP diastolic" },
  spo2: { low: 95, high: 100, unit: "%", label: "SpO₂" },
  random_glucose: { low: 70, high: 140, unit: "mg/dL", label: "Random glucose" },
};

/** Paediatric ranges differ enough that using adult ones is a clinical
 *  error a paediatrician on the panel would spot immediately. */
export function rangeFor(key: string, ageYears: number): Range | undefined {
  const base = VITAL_RANGES[key];
  if (!base) return undefined;
  if (ageYears >= 12) return base;
  if (key === "pulse_bpm") return { ...base, low: ageYears < 1 ? 100 : 70, high: ageYears < 1 ? 160 : 130 };
  if (key === "resp_rate") return { ...base, low: ageYears < 1 ? 30 : 18, high: ageYears < 1 ? 60 : 30 };
  if (key === "bp_systolic") return { ...base, low: 80, high: 115 };
  if (key === "bp_diastolic") return { ...base, low: 50, high: 75 };
  return base;
}

export function flagVital(key: string, value: number | null | undefined, ageYears = 30): Flag | null {
  if (value == null) return null;
  const r = rangeFor(key, ageYears);
  if (!r) return null;
  if (value < r.low) return "low";
  if (value > r.high) return "high";
  return "normal";
}

export function bmi(weightKg?: number | null, heightCm?: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiBand(v: number | null): { label: string; flag: Flag } | null {
  if (v == null) return null;
  if (v < 18.5) return { label: "Underweight", flag: "low" };
  if (v < 23) return { label: "Normal (Asian-Indian cut-off)", flag: "normal" };
  if (v < 25) return { label: "Overweight", flag: "high" };
  return { label: "Obese", flag: "high" };
}

export function summariseVitals(v: Partial<Vitals>, age = 30) {
  return (Object.keys(VITAL_RANGES) as (keyof typeof VITAL_RANGES)[])
    .map((k) => {
      const value = (v as Record<string, number | null>)[k];
      return { key: k, ...VITAL_RANGES[k], value, flag: flagVital(k, value, age) };
    })
    .filter((r) => r.value != null);
}

// ── "Within normal limits" boilerplate ────────────────────────
// A doctor should only have to type the exceptions.
export const WNL_TEXT: Record<string, Record<string, string>> = {
  cvs: {
    inspection: "No precordial bulge, no visible pulsations.",
    palpation: "Apex beat in the 5th intercostal space, mid-clavicular line. No thrills.",
    auscultation: "S1 and S2 heard, normal in intensity. No murmurs, rubs or gallops.",
  },
  respiratory: {
    inspection: "Chest symmetrical, moves equally with respiration. No scars.",
    palpation: "Trachea central. Equal chest expansion. Normal vocal fremitus.",
    percussion: "Resonant note in all lung fields.",
    auscultation: "Bilateral vesicular breath sounds. No added sounds.",
  },
  abdomen: {
    inspection: "Abdomen flat, umbilicus central, no visible peristalsis or scars.",
    palpation: "Soft, non-tender. No hepatosplenomegaly, no palpable masses.",
    percussion: "Tympanic. No shifting dullness.",
    auscultation: "Bowel sounds present and normal.",
  },
  cns: {
    inspection: "Conscious, oriented to time, place and person. GCS 15/15.",
    palpation: "Tone normal in all four limbs. Power 5/5. Reflexes 2+ and symmetrical.",
    auscultation: "No cranial nerve deficit. Plantars flexor.",
  },
  msk: {
    inspection: "No deformity, swelling or muscle wasting.",
    palpation: "No joint tenderness. Full range of motion in all major joints.",
  },
};

export const SYSTEMS = [
  { key: "cvs", label: "Cardiovascular" },
  { key: "respiratory", label: "Respiratory" },
  { key: "abdomen", label: "Abdomen" },
  { key: "cns", label: "Central nervous system" },
  { key: "msk", label: "Musculoskeletal" },
] as const;

export const EXAM_METHODS = ["inspection", "palpation", "percussion", "auscultation"] as const;

// ── ICD-11: the local fallback index ──────────────────────────
// The WHO ICD-11 API is the primary source. This ships as the offline
// fallback so a network blip on demo day is invisible.
export const ICD11_INDEX: { code: string; title: string }[] = [
  { code: "5A11", title: "Type 2 diabetes mellitus" },
  { code: "5A10", title: "Type 1 diabetes mellitus" },
  { code: "5A2Y", title: "Impaired glucose tolerance" },
  { code: "BA00", title: "Essential hypertension" },
  { code: "BA01", title: "Hypertensive heart disease" },
  { code: "BA40", title: "Acute myocardial infarction" },
  { code: "BA41", title: "Angina pectoris" },
  { code: "BD10", title: "Heart failure" },
  { code: "BC81", title: "Atrial fibrillation" },
  { code: "8B20", title: "Cerebral ischaemic stroke" },
  { code: "CA23", title: "Asthma" },
  { code: "CA22", title: "Chronic obstructive pulmonary disease" },
  { code: "CA40", title: "Pneumonia" },
  { code: "CA07", title: "Acute upper respiratory infection" },
  { code: "1B10", title: "Tuberculosis of lung" },
  { code: "1D4Z", title: "Viral fever, unspecified" },
  { code: "1F40", title: "Dengue fever" },
  { code: "1F45", title: "Malaria" },
  { code: "1A00", title: "Cholera" },
  { code: "1A40", title: "Acute gastroenteritis" },
  { code: "DA22", title: "Gastro-oesophageal reflux disease" },
  { code: "DA60", title: "Peptic ulcer disease" },
  { code: "DB90", title: "Chronic liver disease" },
  { code: "DB93", title: "Fatty liver disease" },
  { code: "GB61", title: "Chronic kidney disease" },
  { code: "GB61.3", title: "Chronic kidney disease, stage 3" },
  { code: "GC00", title: "Urinary tract infection" },
  { code: "GA30", title: "Benign prostatic hyperplasia" },
  { code: "3A00", title: "Iron deficiency anaemia" },
  { code: "3A00.0", title: "Iron deficiency anaemia due to blood loss" },
  { code: "3A01", title: "Vitamin B12 deficiency anaemia" },
  { code: "5A00", title: "Hypothyroidism" },
  { code: "5A02", title: "Hyperthyroidism" },
  { code: "FA01", title: "Osteoarthritis of knee" },
  { code: "FA20", title: "Rheumatoid arthritis" },
  { code: "FB80", title: "Low back pain" },
  { code: "FB83", title: "Osteoporosis" },
  { code: "8A80", title: "Migraine" },
  { code: "8A60", title: "Epilepsy" },
  { code: "6A70", title: "Depressive episode" },
  { code: "6B00", title: "Generalised anxiety disorder" },
  { code: "EA80", title: "Atopic dermatitis" },
  { code: "EB00", title: "Urticaria" },
  { code: "EA90", title: "Psoriasis" },
  { code: "9B71", title: "Cataract" },
  { code: "AB70", title: "Otitis media" },
  { code: "JA65", title: "Anaemia complicating pregnancy" },
  { code: "JA24", title: "Gestational diabetes mellitus" },
  { code: "MG30", title: "Chronic pain" },
  { code: "QA00", title: "General examination without complaint" },
];

export function searchIcd11(q: string, limit = 8) {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  return ICD11_INDEX.filter(
    (r) => r.title.toLowerCase().includes(needle) || r.code.toLowerCase().startsWith(needle),
  ).slice(0, limit);
}

// ── Symptom autocomplete for the chief-complaint field ────────
export const SYMPTOM_LIST = [
  "Fever", "Cough", "Dry cough", "Productive cough", "Breathlessness", "Chest pain",
  "Palpitations", "Headache", "Giddiness", "Vomiting", "Nausea", "Loose stools",
  "Constipation", "Abdominal pain", "Burning micturition", "Decreased urine output",
  "Swelling of feet", "Joint pain", "Back pain", "Weakness", "Weight loss",
  "Weight gain", "Loss of appetite", "Rash", "Itching", "Blurred vision",
  "Sore throat", "Ear pain", "Nose block", "Sneezing", "Bleeding per rectum",
  "Excessive thirst", "Excessive urination", "Numbness", "Tingling", "Tremor",
  "Insomnia", "Anxiety", "Low mood", "Cold intolerance", "Heat intolerance",
];

/** Red flags never get triaged by a model. Any of these routes straight to
 *  the emergency screen. */
export const RED_FLAGS = [
  "chest pain", "crushing chest", "severe breathlessness", "unconscious",
  "fainting", "seizure", "fit", "slurred speech", "face droop", "one side weakness",
  "severe bleeding", "vomiting blood", "black stool", "suicidal", "poisoning",
  "snake bite", "burns", "head injury", "no pulse", "not breathing",
];

export function isRedFlag(text: string): boolean {
  const t = text.toLowerCase();
  return RED_FLAGS.some((f) => t.includes(f));
}

// ── Drug safety ───────────────────────────────────────────────
export interface DrugWarning {
  level: "block" | "warn";
  title: string;
  detail: string;
}

export function searchDrugs(q: string, limit = 8): Drug[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  return drugMaster
    .filter(
      (d) =>
        (d.brand_name ?? "").toLowerCase().includes(needle) ||
        d.generic_name.toLowerCase().includes(needle),
    )
    .slice(0, limit);
}

export const drugById = (id: number) => drugMaster.find((d) => d.id === id) ?? null;

/**
 * Allergy conflicts and duplicate therapy appear as a BLOCKING dialog, not
 * a passive banner. Cross-reactivity is checked by drug class, so a
 * penicillin allergy blocks amoxicillin — checking the literal string
 * would miss exactly the case that matters.
 */
export function checkDrug(
  drug: Drug,
  allergies: Allergy[],
  currentDrugTexts: string[],
): DrugWarning[] {
  const out: DrugWarning[] = [];
  const allergens = allergies.map((a) => a.allergen.toLowerCase());
  const classKey = Object.keys(drugAllergenMap).find(
    (k) => (drug.class ?? "").toLowerCase().includes(k.toLowerCase()),
  );
  const triggers = classKey ? drugAllergenMap[classKey] : [];

  for (const a of allergies) {
    const al = a.allergen.toLowerCase();
    const direct =
      drug.generic_name.toLowerCase().includes(al) ||
      (drug.brand_name ?? "").toLowerCase().includes(al);
    const crossReactive = triggers.some((t) => al.includes(t) || t.includes(al.replace(/s$/, "")));
    if (direct || crossReactive) {
      out.push({
        level: a.severity === "severe" || a.severity === "anaphylaxis" ? "block" : "warn",
        title: `Allergy: ${a.allergen}`,
        detail: direct
          ? `${drug.generic_name} is the recorded allergen. Reaction on record: ${a.reaction ?? "unspecified"} (${a.severity}).`
          : `${drug.generic_name} is a ${drug.class}, which cross-reacts with ${a.allergen}. Reaction on record: ${a.reaction ?? "unspecified"} (${a.severity}).`,
      });
    }
  }

  // Duplicate therapy: two drugs of the same class at once
  const dup = currentDrugTexts.find((t) => {
    const other = drugMaster.find((d) =>
      t.toLowerCase().includes(d.generic_name.toLowerCase()),
    );
    return other && other.id !== drug.id && other.class === drug.class && drug.class;
  });
  if (dup) {
    out.push({
      level: "warn",
      title: "Duplicate therapy",
      detail: `The patient is already on ${dup}, which is also a ${drug.class}.`,
    });
  }
  if (allergens.length && drug.schedule === "X") {
    out.push({ level: "warn", title: "Schedule X drug", detail: "Requires a duplicate prescription retained by the pharmacy." });
  }
  return out;
}

// ── Investigation panel presets: one click, not seven ─────────
export const PANEL_PRESETS: { name: string; tests: string[] }[] = [
  { name: "CBC + LFT + RFT", tests: ["Complete blood count", "Liver function test", "Renal function test"] },
  { name: "Diabetes review", tests: ["HbA1c", "Fasting blood sugar", "Post-prandial blood sugar", "Serum creatinine", "Urine microalbumin"] },
  { name: "Cardiac workup", tests: ["ECG", "2D Echocardiogram", "Lipid profile", "Troponin I"] },
  { name: "Fever workup", tests: ["Complete blood count", "Dengue NS1 + IgM", "Malaria antigen", "Widal", "Urine routine"] },
  { name: "Thyroid", tests: ["TSH", "Free T4", "Free T3"] },
  { name: "Anaemia workup", tests: ["Complete blood count", "Peripheral smear", "Serum ferritin", "Vitamin B12"] },
];

// ── Advice snippet library, per speciality ────────────────────
export const ADVICE_SNIPPETS: Record<string, string[]> = {
  "General Medicine": [
    "Salt restriction: less than 5 g a day. Avoid pickles, papad and packaged snacks.",
    "Walk briskly for 30 minutes, five days a week.",
    "Check blood pressure weekly at the same time of day and bring the readings.",
    "Do not stop any medicine without speaking to me first.",
  ],
  Cardiology: [
    "Report immediately if chest pain lasts more than 15 minutes or comes at rest.",
    "Weigh yourself every morning. A gain of 2 kg in three days needs a call.",
    "Continue aspirin and statin daily. These are not to be taken only when unwell.",
  ],
  Paediatrics: [
    "Give the inhaler with a spacer, two puffs, and rinse the mouth after.",
    "Return the same day if there is fast breathing, chest indrawing, or refusal to feed.",
    "Complete the full antibiotic course even if the fever settles.",
  ],
  Orthopaedics: [
    "Quadriceps strengthening exercises, 3 sets of 10, twice daily.",
    "Avoid squatting, cross-legged sitting and stairs where possible.",
    "Ice for 15 minutes after activity, not heat, for the first two weeks.",
  ],
  Dermatology: [
    "Apply the cream in a thin layer twice daily; do not use on broken skin.",
    "Use a fragrance-free moisturiser within three minutes of bathing.",
    "Sun protection SPF 30 or above, reapplied every three hours outdoors.",
  ],
  "Obstetrics & Gynaecology": [
    "Iron and folic acid daily, one hour away from milk or tea.",
    "Report immediately for bleeding, severe headache, or reduced foetal movements.",
    "Next scan at 20 weeks. Bring all previous reports.",
  ],
};

export const RED_FLAG_ADVICE = [
  "Return immediately if breathlessness worsens.",
  "Return immediately for chest pain, fainting or confusion.",
  "Return if fever persists beyond 3 days despite medication.",
  "Return if there is bleeding from any site.",
  "Return if there is persistent vomiting or you cannot keep fluids down.",
];

export const COMMON_COMPLAINT_CHIPS = [
  "Fever", "Cough", "Body ache", "Headache", "Stomach pain",
  "Follow-up", "Report review", "Breathlessness", "Giddiness", "Rash",
];
