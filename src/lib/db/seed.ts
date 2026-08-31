// Deterministic demo world. Mirrors supabase/seed.sql — same UUIDs, same
// people, same clinical story — so a demo run against the mock store and a
// demo run against a linked Supabase project look identical.
//
// Nothing here uses Math.random(). Every reset produces the same record,
// which is what makes six rehearsed run-throughs possible.

import type {
  Allergy, Appointment, Bill, BillItem, CareRelationship, CaseSheet,
  ChronicCondition, DailyCheckin, DeviceReading, Diagnosis, Doctor,
  DoctorAvailability, DocumentRecord, Drug, EmergencyCard, EmergencyContact,
  FamilyHistory, Hospital, InsurancePolicy, Patient, PatientMedication,
  Prescription, Profile, Specialization, SurgicalHistory, Vitals,
} from "@/lib/types";
import { addIstDays, istDay, istInstant } from "@/lib/tz";

const H = (n: number) => `a1000000-0000-4000-8000-00000000000${n}`;
const D = (n: number) => `d1000000-0000-4000-8000-00000000000${n}`;
const P = (n: number) => `c1000000-0000-4000-8000-00000000000${n}`;

/** Stable pseudo-random: same input, same output, forever. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
const pick = <T,>(arr: T[], seed: number): T => arr[Math.floor(rand(seed) * arr.length) % arr.length];
const iso = (d: Date) => d.toISOString();

/** n days ago at an IST wall-clock hour. Clinic hours are IST hours; the
 *  instant stored is UTC. A server running in UTC and a clinic running in
 *  Kolkata must agree about what "the 9 a.m. slot" means. */
const daysAgo = (n: number, hour = 10) =>
  istInstant(addIstDays(istDay(), -n), `${String(hour).padStart(2, "0")}:00`);

export const specializations: Specialization[] = [
  { id: 1, name: "General Medicine", name_hi: "सामान्य चिकित्सा" },
  { id: 2, name: "Cardiology", name_hi: "हृदय रोग" },
  { id: 3, name: "Paediatrics", name_hi: "बाल रोग" },
  { id: 4, name: "Orthopaedics", name_hi: "अस्थि रोग" },
  { id: 5, name: "Dermatology", name_hi: "त्वचा रोग" },
  { id: 6, name: "Obstetrics & Gynaecology", name_hi: "स्त्री एवं प्रसूति रोग" },
];

export const hospitals: Hospital[] = [
  {
    id: H(1), name: "Sanjeevani Multispeciality Hospital", hfr_id: "HFR-MH-004821",
    address: "Plot 14, Senapati Bapat Road", city: "Pune", state: "Maharashtra",
    pincode: "411016", lat: 18.5286, lng: 73.8335,
    phone: "+912025530011", emergency_phone: "+912025530000",
  },
  {
    id: H(2), name: "Civil Hospital, Kothrud", hfr_id: "HFR-MH-009117",
    address: "Paud Road, Kothrud", city: "Pune", state: "Maharashtra",
    pincode: "411038", lat: 18.5073, lng: 73.8074,
    phone: "+912025432200", emergency_phone: "108",
  },
  {
    id: H(3), name: "Aarogya Clinic & Diagnostics", hfr_id: "HFR-MH-011903",
    address: "Lane 5, Koregaon Park", city: "Pune", state: "Maharashtra",
    pincode: "411001", lat: 18.5362, lng: 73.8932,
    phone: "+912026150909", emergency_phone: null,
  },
];

const doctorSeed: [number, string, string, string, string[], number, string | null, number, string[], string, number, boolean][] = [
  [1, "Dr. Anita Deshmukh", "anita.deshmukh@nidan.in", "MMC-2009-44127", ["MBBS", "MD (General Medicine)"], 1, "Diabetology", 15, ["en", "hi", "mr"], "Consultant physician running a diabetes and hypertension practice. Believes most of medicine is follow-up.", 600, true],
  [2, "Dr. Rakesh Iyer", "rakesh.iyer@nidan.in", "MMC-2004-31880", ["MBBS", "MD (Medicine)", "DM (Cardiology)"], 2, "Interventional Cardiology", 21, ["en", "hi", "ta"], "Interventional cardiologist; runs the cath lab at Sanjeevani.", 1200, true],
  [3, "Dr. Meera Pillai", "meera.pillai@nidan.in", "MMC-2013-58204", ["MBBS", "MD (Paediatrics)"], 3, "Neonatology", 11, ["en", "ml", "hi"], "Paediatrician; newborn follow-up and childhood asthma.", 700, true],
  [4, "Dr. Sameer Qureshi", "sameer.qureshi@nidan.in", "MMC-2011-51993", ["MBBS", "MS (Orthopaedics)"], 4, "Sports Injury", 13, ["en", "hi", "ur"], "Orthopaedic surgeon; arthroscopy and joint preservation.", 900, true],
  [5, "Dr. Nandini Rao", "nandini.rao@nidan.in", "MMC-2016-66710", ["MBBS", "MD (Dermatology)"], 5, null, 8, ["en", "kn", "hi"], "Dermatologist; chronic urticaria and paediatric eczema.", 800, true],
  [6, "Dr. Vikram Shinde", "vikram.shinde@nidan.in", "MMC-2007-39442", ["MBBS", "MD (General Medicine)"], 1, "Infectious Disease", 17, ["en", "mr", "hi"], "Physician; infectious disease and antimicrobial stewardship.", 650, true],
  [7, "Dr. Farhan Ali", "farhan.ali@nidan.in", "MMC-2018-71225", ["MBBS", "DNB (Cardiology)"], 2, "Heart Failure", 6, ["en", "hi", "ur"], "Cardiologist; heart-failure clinic on Tuesdays.", 1000, false],
  [8, "Dr. Priya Nayak", "priya.nayak@nidan.in", "MMC-2012-54118", ["MBBS", "MS (OBG)"], 6, "High-risk Obstetrics", 12, ["en", "hi", "kn"], "Obstetrician; antenatal care and high-risk pregnancy.", 850, true],
];

const patientSeed: [number, string, string, string, string, Patient["sex"], Patient["blood_group"], number, string, string, Patient["organ_donor"], string | null, string][] = [
  [1, "Sunita Kale", "sunita.kale@example.in", "+919011220001", "1968-03-14", "female", "B+", 154, "Flat 3, Shivneri CHS, Karve Nagar", "411052", "registered", "12345678901234", "hi"],
  [2, "Ramesh Patil", "ramesh.patil@example.in", "+919011220002", "1957-11-02", "male", "O+", 171.5, "22 Shanti Nagar, Wanowrie", "411040", "undisclosed", "12345678901235", "en"],
  [3, "Aarav Sharma", "aarav.sharma@example.in", "+919011220003", "2018-07-21", "male", "A+", 112, "B-704 Rose County, Baner", "411045", "undisclosed", null, "en"],
  [4, "Fatima Shaikh", "fatima.shaikh@example.in", "+919011220004", "1994-01-09", "female", "AB-", 160, "14 Nagar Road, Yerwada", "411006", "not_registered", "12345678901237", "hi"],
  [5, "Joseph D'Souza", "joseph.dsouza@example.in", "+919011220005", "1982-06-30", "male", "O-", 176, "9 Mount Villa, Camp", "411001", "registered", "12345678901238", "te"],
];

export const profiles: Profile[] = [
  ...doctorSeed.map(([n, name, email]) => ({
    id: D(n), role: "doctor" as const, full_name: name,
    phone: `+91982200110${n}`, email, avatar_path: null, preferred_locale: "en",
  })),
  ...patientSeed.map(([n, name, email, phone, , , , , , , , , locale]) => ({
    id: P(n), role: "patient" as const, full_name: name,
    phone, email, avatar_path: null, preferred_locale: locale,
  })),
];

export const doctors: Doctor[] = doctorSeed.map(
  ([n, , , reg, quals, spec, sub, exp, langs, bio, fee, verified]) => ({
    id: D(n), registration_no: reg, hpr_id: `HPR-229100441${n}`,
    qualifications: quals, specialization_id: spec, sub_specialty: sub,
    experience_years: exp, languages: langs, bio,
    awards: n === 2
      ? [{ title: "Best Paper, CSI Annual", year: 2019, body: "Cardiological Society of India" }]
      : [],
    consultation_fee: fee,
    verified_at: verified ? iso(daysAgo(400)) : null,
  }),
);

export const patients: Patient[] = patientSeed.map(
  ([n, , , , dob, sex, bg, height, addr, pin, donor, abha]) => ({
    id: P(n), mrn: `ND-2026-00048${n}`,
    abha_number: abha,
    abha_address: abha ? `${patientSeed[n - 1][1].toLowerCase().split(" ")[0]}@abdm` : null,
    date_of_birth: dob, sex, gender_identity: null, blood_group: bg,
    height_cm: height, address_line1: addr, city: "Pune", state: "Maharashtra",
    pincode: pin, organ_donor: donor,
    organ_donor_ref: donor === "registered" ? `NOTTO-PLG-${700000 + n}` : null,
  }),
);

export const doctorHospitals: { doctor_id: string; hospital_id: string; department: string }[] = [
  { doctor_id: D(1), hospital_id: H(1), department: "Internal Medicine" },
  { doctor_id: D(1), hospital_id: H(3), department: "OPD" },
  { doctor_id: D(2), hospital_id: H(1), department: "Cardiology" },
  { doctor_id: D(3), hospital_id: H(2), department: "Paediatrics" },
  { doctor_id: D(4), hospital_id: H(1), department: "Orthopaedics" },
  { doctor_id: D(5), hospital_id: H(3), department: "Dermatology" },
  { doctor_id: D(6), hospital_id: H(2), department: "Internal Medicine" },
  { doctor_id: D(7), hospital_id: H(1), department: "Cardiology" },
  { doctor_id: D(8), hospital_id: H(2), department: "Obstetrics" },
];

export const availability: DoctorAvailability[] = doctorHospitals.flatMap((dh, i) => [
  ...[1, 2, 3, 4, 5, 6].map((wd) => ({
    id: `av-m-${i}-${wd}`, doctor_id: dh.doctor_id, hospital_id: dh.hospital_id,
    weekday: wd, start_time: "09:00", end_time: "13:00", slot_minutes: 15,
  })),
  ...[1, 2, 3, 4, 5].map((wd) => ({
    id: `av-e-${i}-${wd}`, doctor_id: dh.doctor_id, hospital_id: dh.hospital_id,
    weekday: wd, start_time: "17:00", end_time: "20:00", slot_minutes: 20,
  })),
]);

export const drugMaster: Drug[] = [
  ["Glycomet", "Metformin", "500 mg", "tablet", "H", "Biguanide"],
  ["Glycomet", "Metformin", "1000 mg", "tablet", "H", "Biguanide"],
  ["Amaryl", "Glimepiride", "2 mg", "tablet", "H", "Sulfonylurea"],
  ["Januvia", "Sitagliptin", "100 mg", "tablet", "H", "DPP-4 inhibitor"],
  ["Lantus", "Insulin glargine", "100 IU/mL", "injection", "H", "Insulin"],
  ["Telma", "Telmisartan", "40 mg", "tablet", "H", "ARB"],
  ["Telma-H", "Telmisartan + Hydrochlorothiazide", "40/12.5 mg", "tablet", "H", "ARB + Thiazide"],
  ["Amlokind", "Amlodipine", "5 mg", "tablet", "H", "Calcium channel blocker"],
  ["Ecosprin", "Aspirin", "75 mg", "tablet", "H", "Antiplatelet"],
  ["Clopilet", "Clopidogrel", "75 mg", "tablet", "H", "Antiplatelet"],
  ["Rosuvas", "Rosuvastatin", "10 mg", "tablet", "H", "Statin"],
  ["Atorva", "Atorvastatin", "20 mg", "tablet", "H", "Statin"],
  ["Lasix", "Furosemide", "40 mg", "tablet", "H", "Loop diuretic"],
  ["Aldactone", "Spironolactone", "25 mg", "tablet", "H", "Aldosterone antagonist"],
  ["Metolar", "Metoprolol", "25 mg", "tablet", "H", "Beta blocker"],
  ["Concor", "Bisoprolol", "5 mg", "tablet", "H", "Beta blocker"],
  ["Augmentin", "Amoxicillin + Clavulanate", "625 mg", "tablet", "H1", "Penicillin"],
  ["Mox", "Amoxicillin", "500 mg", "capsule", "H1", "Penicillin"],
  ["Taxim-O", "Cefixime", "200 mg", "tablet", "H1", "Cephalosporin"],
  ["Azithral", "Azithromycin", "500 mg", "tablet", "H1", "Macrolide"],
  ["Ciplox", "Ciprofloxacin", "500 mg", "tablet", "H1", "Fluoroquinolone"],
  ["Flagyl", "Metronidazole", "400 mg", "tablet", "H", "Nitroimidazole"],
  ["Bactrim", "Cotrimoxazole", "800/160 mg", "tablet", "H1", "Sulfonamide"],
  ["Crocin", "Paracetamol", "650 mg", "tablet", "OTC", "Analgesic"],
  ["Combiflam", "Ibuprofen + Paracetamol", "400/325 mg", "tablet", "OTC", "NSAID"],
  ["Naprosyn", "Naproxen", "250 mg", "tablet", "H", "NSAID"],
  ["Zerodol-SP", "Aceclofenac + Serratiopeptidase", "100/15 mg", "tablet", "H", "NSAID"],
  ["Pan", "Pantoprazole", "40 mg", "tablet", "H", "Proton pump inhibitor"],
  ["Rantac", "Ranitidine", "150 mg", "tablet", "H", "H2 blocker"],
  ["Ondem", "Ondansetron", "4 mg", "tablet", "H", "Antiemetic"],
  ["Allegra", "Fexofenadine", "120 mg", "tablet", "OTC", "Antihistamine"],
  ["Cetzine", "Cetirizine", "10 mg", "tablet", "OTC", "Antihistamine"],
  ["Montair-LC", "Montelukast + Levocetirizine", "10/5 mg", "tablet", "H", "Leukotriene antagonist"],
  ["Asthalin", "Salbutamol", "100 mcg", "inhaler", "H", "SABA"],
  ["Foracort", "Formoterol + Budesonide", "6/200 mcg", "inhaler", "H", "LABA + ICS"],
  ["Wysolone", "Prednisolone", "10 mg", "tablet", "H", "Corticosteroid"],
  ["Thyronorm", "Levothyroxine", "50 mcg", "tablet", "H", "Thyroid hormone"],
  ["Shelcal", "Calcium carbonate + Vitamin D3", "500/250 IU", "tablet", "OTC", "Supplement"],
  ["Orofer-XT", "Ferrous ascorbate + Folic acid", "100/1.5 mg", "tablet", "OTC", "Haematinic"],
  ["Neurobion Forte", "Vitamin B complex", "—", "tablet", "OTC", "Supplement"],
  ["Zincovit", "Multivitamin + Zinc", "—", "tablet", "OTC", "Supplement"],
  ["Duphalac", "Lactulose", "10 g/15 mL", "syrup", "OTC", "Osmotic laxative"],
].map((r, i) => ({
  id: i + 1, brand_name: r[0], generic_name: r[1], strength: r[2],
  form: r[3], schedule: r[4], class: r[5],
}));

/** A penicillin allergy must block amoxicillin, not just "Penicillin". */
export const drugAllergenMap: Record<string, string[]> = {
  Penicillin: ["penicillin"],
  Cephalosporin: ["penicillin"],
  Sulfonamide: ["sulfonamide", "sulfa", "cotrimoxazole"],
  NSAID: ["ibuprofen", "nsaid", "aspirin", "diclofenac"],
  Macrolide: ["azithromycin", "erythromycin"],
  Antiplatelet: ["aspirin"],
};

export const allergies: Allergy[] = [
  [1, "Penicillin", "drug", "Urticaria and facial swelling", "severe"],
  [1, "Dust mite", "environmental", "Rhinitis", "mild"],
  [2, "Sulfonamides", "drug", "Widespread rash", "moderate"],
  [3, "Peanut", "food", "Lip swelling, wheeze", "anaphylaxis"],
  [5, "Ibuprofen", "drug", "Gastric bleed", "severe"],
].map((r, i) => ({
  id: `alg-${i}`, patient_id: P(r[0] as number), allergen: r[1] as string,
  category: r[2] as Allergy["category"], reaction: r[3] as string,
  severity: r[4] as Allergy["severity"], recorded_by: D(1),
  recorded_at: iso(daysAgo(500)),
}));

export const chronicConditions: ChronicCondition[] = [
  [1, "Type 2 diabetes mellitus", "5A11", 3600, true],
  [1, "Essential hypertension", "BA00", 2900, true],
  [2, "Chronic kidney disease, stage 3", "GB61.3", 1900, true],
  [2, "Essential hypertension", "BA00", 5200, true],
  [3, "Asthma", "CA23", 800, true],
  [4, "Iron deficiency anaemia", "3A00.0", 530, true],
].map((r, i) => ({
  id: `cc-${i}`, patient_id: P(r[0] as number), condition: r[1] as string,
  icd11_code: r[2] as string, since: iso(daysAgo(r[3] as number)).slice(0, 10),
  on_treatment: r[4] as boolean,
}));

export const familyHistory: FamilyHistory[] = [
  [1, "Mother", "Type 2 diabetes mellitus", 52],
  [1, "Father", "Ischaemic heart disease", 61],
  [2, "Brother", "Chronic kidney disease", 58],
  [5, "Father", "Colorectal carcinoma", 66],
].map((r, i) => ({
  id: `fh-${i}`, patient_id: P(r[0] as number), relation: r[1] as string,
  condition: r[2] as string, age_at_onset: r[3] as number,
}));

export const surgicalHistory: SurgicalHistory[] = [
  [1, "Laparoscopic cholecystectomy", 2480, "Sanjeevani Multispeciality Hospital", "Dr. R. Kulkarni", "General"],
  [2, "Right inguinal hernia repair", 4400, "Civil Hospital, Kothrud", "Dr. A. Bhosale", "Spinal"],
  [5, "ACL reconstruction, left knee", 1650, "Sanjeevani Multispeciality Hospital", "Dr. Sameer Qureshi", "Regional"],
].map((r, i) => ({
  id: `sh-${i}`, patient_id: P(r[0] as number), procedure_name: r[1] as string,
  performed_on: iso(daysAgo(r[2] as number)).slice(0, 10),
  hospital_name: r[3] as string, surgeon_name: r[4] as string,
  anaesthesia: r[5] as string, complications: null, is_self_reported: i === 2,
}));

export const patientMedications: PatientMedication[] = [
  [1, "Metformin (Glycomet)", "500 mg", "1-0-1", 1050],
  [1, "Telmisartan (Telma)", "40 mg", "1-0-0", 1050],
  [1, "Rosuvastatin (Rosuvas)", "10 mg", "0-0-1", 380],
  [2, "Telmisartan (Telma)", "40 mg", "1-0-0", 1500],
  [2, "Furosemide (Lasix)", "40 mg", "1-0-0", 580],
  [2, "Calcium carbonate + D3 (Shelcal)", "500 mg", "0-1-0", 580],
  [3, "Salbutamol (Asthalin)", "100 mcg", "SOS", 800],
  [3, "Montelukast + Levocetirizine (Montair-LC)", "5 mg", "0-0-1", 290],
  [4, "Ferrous ascorbate + Folic acid (Orofer-XT)", "100 mg", "0-1-0", 530],
].map((r, i) => ({
  id: `pm-${i}`, patient_id: P(r[0] as number), prescription_item_id: null,
  drug_text: r[1] as string, dose: r[2] as string, frequency: r[3] as string,
  started_on: iso(daysAgo(r[4] as number)).slice(0, 10), ended_on: null,
  is_self_reported: false, adherence_pct: 70 + ((i * 7) % 30),
}));

export const emergencyContacts: EmergencyContact[] = [
  [1, "Prakash Kale", "Husband", "+919011990001", true],
  [1, "Rutuja Kale", "Daughter", "+919011990002", false],
  [2, "Sheetal Patil", "Daughter", "+919011990003", true],
  [3, "Neha Sharma", "Mother", "+919011990004", true],
  [4, "Imran Shaikh", "Brother", "+919011990005", true],
  [5, "Maria D'Souza", "Wife", "+919011990006", true],
].map((r, i) => ({
  id: `ec-${i}`, patient_id: P(r[0] as number), name: r[1] as string,
  relation: r[2] as string, phone: r[3] as string, is_primary: r[4] as boolean,
}));

export const emergencyCards: EmergencyCard[] = [
  "EMG-8f2a91c4d7", "EMG-3b71ee02af", "EMG-c90d54187b",
  "EMG-11ae63cd90", "EMG-7d40b2fa16",
].map((token, i) => ({
  id: `emc-${i}`, patient_id: P(i + 1), token,
  issued_at: iso(daysAgo(120)), revoked_at: null,
}));

export const insurancePolicies: InsurancePolicy[] = [
  { id: "ins-1", patient_id: P(1), insurer: "Star Health", policy_no: "SH-2291-004821", scheme: "Individual", sum_insured: 500000, valid_from: "2025-04-01", valid_to: "2026-03-31", tpa_name: "MediAssist", tpa_phone: "+918000112233", used: 84200 },
  { id: "ins-2", patient_id: P(2), insurer: "Ayushman Bharat", policy_no: "PMJAY-MH-77120031", scheme: "PM-JAY", sum_insured: 500000, valid_from: "2024-01-01", valid_to: "2029-12-31", tpa_name: null, tpa_phone: "14555", used: 131500 },
  { id: "ins-3", patient_id: P(5), insurer: "ICICI Lombard", policy_no: "IL-9910-556677", scheme: "Corporate", sum_insured: 1000000, valid_from: "2026-01-01", valid_to: "2026-12-31", tpa_name: "Paramount", tpa_phone: "+918000445566", used: 22400 },
];

export const ambulanceProviders = [
  { id: 1, name: "National Ambulance Service", phone: "108", city: null, is_national: true },
  { id: 2, name: "Emergency Response", phone: "112", city: null, is_national: true },
  { id: 3, name: "Sanjeevani Ambulance", phone: "+912025530000", city: "Pune", is_national: false },
  { id: 4, name: "Civil Hospital Ambulance", phone: "+912025432299", city: "Pune", is_national: false },
];

// ── Two years of visits ────────────────────────────────────────
// Generated, not typed, so the timeline and the trend charts have
// enough density to look like a real record.

const COMPLAINTS = [
  "Fever with chills", "Chest discomfort on exertion", "Dry cough", "Generalised weakness",
  "Follow-up: sugar review", "Throbbing headache", "Pain in both knees",
  "Breathlessness on climbing stairs", "Burning micturition", "Routine follow-up",
];
const ADVICE = [
  "Continue current medication. Salt restriction reinforced. Review in 4 weeks or earlier if symptoms worsen.",
  "Increase Metformin to twice daily with meals. Repeat HbA1c before the next visit.",
  "Complete the full antibiotic course even if the fever settles. Plenty of oral fluids.",
  "Steam inhalation twice daily. Return if breathlessness or chest pain develops.",
  "Quadriceps strengthening exercises, 3 sets of 10 twice daily. Avoid squatting and stairs.",
  "Iron on an empty stomach, one hour away from milk or tea. Repeat haemogram in 6 weeks.",
  "Small frequent meals, nothing for two hours before lying down. Raise the head end of the bed.",
  "Inhaler with a spacer, two puffs twice daily. Rinse the mouth after each use.",
  "Weigh yourself every morning; a gain of 2 kg in three days needs a call.",
  "Walk briskly 30 minutes a day, five days a week. Bring a home BP diary next time.",
];

const DXS: [string, string][] = [
  ["Type 2 diabetes mellitus", "5A11"], ["Essential hypertension", "BA00"],
  ["Acute viral fever", "1D4Z"], ["Upper respiratory tract infection", "CA07"],
  ["Osteoarthritis of knee", "FA01"], ["Iron deficiency anaemia", "3A00.0"],
  ["Gastro-oesophageal reflux disease", "DA22"], ["Asthma, mild persistent", "CA23"],
];

export const appointments: Appointment[] = [];
export const caseSheets: CaseSheet[] = [];
export const diagnoses: Diagnosis[] = [];
export const vitals: Vitals[] = [];
export const bills: Bill[] = [];
export const prescriptions: Prescription[] = [];
export const documents: DocumentRecord[] = [];

let n = 0;
for (let pi = 1; pi <= 5; pi++) {
  for (let visit = 13; visit >= 0; visit--) {
    n++;
    const dh = doctorHospitals[n % doctorHospitals.length];
    const when = daysAgo(visit * 52 + (n % 11), 9 + (n % 4));
    const apptId = `appt-${n}`;
    const csId = `cs-${n}`;
    const complaint = COMPLAINTS[n % COMPLAINTS.length];
    const [dxTitle, dxCode] = DXS[n % DXS.length];

    appointments.push({
      id: apptId, token_no: (n % 20) + 1, patient_id: P(pi),
      doctor_id: dh.doctor_id, hospital_id: dh.hospital_id,
      slot_start: iso(when), slot_end: iso(new Date(when.getTime() + 15 * 60000)),
      status: "completed", reason: complaint, mode: "in_person",
      created_at: iso(new Date(when.getTime() - 3 * 864e5)),
      cancelled_at: null, cancel_reason: null,
    });

    caseSheets.push({
      id: csId, patient_id: P(pi), doctor_id: dh.doctor_id,
      hospital_id: dh.hospital_id, appointment_id: apptId,
      visit_type: visit === 13 ? "opd" : "followup",
      chief_complaints: [{
        complaint, duration_value: (n % 6) + 1,
        duration_unit: n % 3 === 0 ? "weeks" : "days",
      }],
      hopi: {
        onset: pick(["sudden", "gradual"], n),
        location: pick(["retrosternal", "diffuse", "left lower limb", "epigastric"], n + 3),
        character: pick(["dull ache", "burning", "cramping", "sharp"], n + 7),
        aggravating: pick(["exertion", "lying down", "cold air", "fatty food"], n + 11),
        relieving: pick(["rest", "antacid", "warm compress", "sitting up"], n + 13),
        timing: pick(["intermittent", "continuous", "nocturnal"], n + 17),
        severity_0_10: (n % 8) + 2,
        associated: n % 2 ? ["nausea"] : ["sweating", "palpitations"],
        progression: pick(["static", "worsening", "improving"], n + 19),
      },
      past_history: {
        diabetes: { present: pi === 1, since: pi === 1 ? "2016" : undefined, on_treatment: pi === 1 },
        hypertension: { present: pi === 1 || pi === 2, on_treatment: true },
        asthma: { present: pi === 3, on_treatment: pi === 3 },
      },
      personal_history: {
        diet: pi === 3 ? "veg" : pick(["veg", "non_veg", "eggetarian"], pi),
        appetite: "normal", sleep: n % 5 === 0 ? "disturbed" : "normal",
        bowel: "regular", bladder: "normal",
        tobacco: { use: pi === 2, qty_per_day: pi === 2 ? 10 : 0, years: pi === 2 ? 22 : 0, pack_years: pi === 2 ? 11 : 0 },
        alcohol: { use: pi === 5, units_per_week: pi === 5 ? 6 : 0 },
        occupation: ["Teacher", "Retired bank clerk", "Student", "Software engineer", "Chef"][pi - 1],
        exercise: pick(["sedentary", "walks 30 min daily", "gym 3×/week"], pi),
      },
      menstrual_obstetric: pi === 1 || pi === 4
        ? { lmp: iso(daysAgo(visit * 52 + 20)).slice(0, 10), cycle: "28/4, regular", parity: "P2L2", obstetric_score: "G2P2L2A0" }
        : null,
      treatment_history: n % 4 === 0 ? "Took over-the-counter paracetamol for three days without relief." : null,
      general_exam: {
        pallor: n % 4 === 0 ? "present" : "absent",
        icterus: "absent", cyanosis: "absent", clubbing: "absent",
        lymphadenopathy: n % 9 === 0 ? "not_examined" : "absent",
        oedema: n % 7 === 0 ? "present" : "absent",
        dehydration: "absent",
        build: pick(["well built and nourished", "moderately built", "thin built"], n),
      },
      systemic_exam: {
        cvs: { wnl: n % 3 !== 0, auscultation: n % 3 === 0 ? "Grade 2 ejection systolic murmur at the aortic area" : "S1 S2 heard, no murmur" },
        respiratory: { wnl: n % 5 !== 0, auscultation: n % 5 === 0 ? "Bilateral rhonchi" : "Bilateral vesicular breath sounds, no added sounds" },
        abdomen: { wnl: true, palpation: "Soft, non-tender, no organomegaly" },
        cns: { wnl: true },
        msk: { wnl: n % 6 !== 0 },
      },
      provisional_dx: dxTitle,
      differential_dx: [DXS[(n + 1) % DXS.length][0], DXS[(n + 4) % DXS.length][0]],
      advice: ADVICE[n % ADVICE.length],
      follow_up_on: iso(new Date(when.getTime() + 28 * 864e5)).slice(0, 10),
      referred_to: n % 11 === 0 ? "Dietician" : null,
      status: "finalized",
      finalized_at: iso(new Date(when.getTime() + 25 * 60000)),
      ai_summary: null, amends_id: null,
      created_at: iso(when), updated_at: iso(when),
    });

    diagnoses.push({
      id: `dx-${n}`, case_sheet_id: csId, patient_id: P(pi),
      icd11_code: dxCode, icd11_title: dxTitle, free_text: null,
      certainty: n % 3 === 0 ? "confirmed" : "provisional",
      is_chronic: n % 4 === 0, onset_date: null,
    });

    vitals.push({
      id: `vt-${n}`, patient_id: P(pi), case_sheet_id: csId,
      recorded_at: iso(when), source: "clinic",
      temperature_c: Math.round((36.6 + rand(n) * 2.2) * 10) / 10,
      pulse_bpm: 66 + Math.floor(rand(n + 1) * 38),
      resp_rate: 14 + Math.floor(rand(n + 2) * 6),
      bp_systolic: 110 + Math.floor(rand(n + 3) * 52),
      bp_diastolic: 68 + Math.floor(rand(n + 4) * 28),
      spo2: 94 + Math.floor(rand(n + 5) * 6),
      weight_kg: Math.round((pi === 3 ? 22 : 54 + pi * 6 + rand(n + 6) * 8) * 10) / 10,
      random_glucose: pi === 1 ? 120 + Math.floor(rand(n + 7) * 110) : 84 + Math.floor(rand(n + 7) * 46),
      pain_score: (n % 8),
    });

    const consult = doctors.find((d) => d.id === dh.doctor_id)!.consultation_fee;
    const pharmacy = (n % 9) * 120;
    const lab = (n % 5) * 180;
    const subtotal = consult + pharmacy + lab;
    const discount = n % 5 === 0 ? 100 : 0;
    const total = subtotal - discount;
    const covered = n % 3 === 0 ? Math.round(total * 0.6) : 0;
    const billId = `bill-${n}`;
    const items: BillItem[] = [
      { id: `bi-${n}-1`, bill_id: billId, category: "consultation", description: "OPD consultation", qty: 1, unit_price: consult, amount: consult },
      ...(pharmacy ? [{ id: `bi-${n}-2`, bill_id: billId, category: "pharmacy" as const, description: "Dispensed medication", qty: 1, unit_price: pharmacy, amount: pharmacy }] : []),
      ...(lab ? [{ id: `bi-${n}-3`, bill_id: billId, category: "lab" as const, description: "Laboratory panel", qty: 1, unit_price: lab, amount: lab }] : []),
    ];
    bills.push({
      id: billId, patient_id: P(pi), hospital_id: dh.hospital_id, case_sheet_id: csId,
      bill_no: `INV-${iso(when).slice(0, 7).replace("-", "")}-${String(n).padStart(5, "0")}`,
      billed_on: iso(when).slice(0, 10), subtotal, discount, tax: 0, total,
      insurance_covered: covered, patient_payable: total - covered,
      status: n % 8 === 0 ? "unpaid" : "paid", items,
    });

    // A prescription on roughly two visits in three
    if (n % 3 !== 0) {
      const d1 = drugMaster[(n * 3) % drugMaster.length];
      const d2 = drugMaster[(n * 7 + 5) % drugMaster.length];
      prescriptions.push({
        id: `rx-${n}`, case_sheet_id: csId, patient_id: P(pi),
        doctor_id: dh.doctor_id, issued_at: iso(when),
        verify_token: `RXV-${String(n).padStart(6, "0")}`,
        items: [
          { id: `rxi-${n}-1`, prescription_id: `rx-${n}`, drug_id: d1.id, drug_text: `${d1.generic_name} (${d1.brand_name})`, dose: d1.strength ?? "", frequency: "1-0-1", route: "oral", timing: "after food", duration_days: 5, quantity: 10, instructions: null },
          { id: `rxi-${n}-2`, prescription_id: `rx-${n}`, drug_id: d2.id, drug_text: `${d2.generic_name} (${d2.brand_name})`, dose: d2.strength ?? "", frequency: "0-0-1", route: "oral", timing: "before bed", duration_days: 10, quantity: 10, instructions: "Do not skip" },
        ],
      });
    }

    // Lab reports carry structured analytes, so Haemoglobin can be
    // plotted across five years of otherwise-scattered PDFs.
    if (n % 2 === 0) {
      const hb = Math.round((10.4 + rand(n + 21) * 4.4) * 10) / 10;
      const creat = Math.round((0.7 + rand(n + 22) * (pi === 2 ? 1.6 : 0.5)) * 100) / 100;
      documents.push({
        id: `doc-${n}`, patient_id: P(pi), case_sheet_id: csId,
        kind: "lab_report", title: `Complete Blood Count + RFT — ${hospitals.find(h => h.id === dh.hospital_id)!.name.split(" ")[0]}`,
        storage_path: `reports/${P(pi)}/doc-${n}.pdf`, mime_type: "application/pdf",
        size_bytes: 184320 + n * 97, report_date: iso(when).slice(0, 10),
        ordering_doctor: dh.doctor_id,
        ocr_text: `Haemoglobin ${hb} g/dL. Total leucocyte count ${6000 + n * 31}/µL. Serum creatinine ${creat} mg/dL. Blood urea ${22 + (n % 30)} mg/dL. Reported at ${hospitals.find(h => h.id === dh.hospital_id)!.name}.`,
        extracted_values: [
          { analyte: "Haemoglobin", value: hb, unit: "g/dL", ref: "12–15", flag: hb < 12 ? "low" : hb > 15 ? "high" : "normal" },
          { analyte: "Creatinine", value: creat, unit: "mg/dL", ref: "0.6–1.2", flag: creat > 1.2 ? "high" : "normal" },
          { analyte: "TLC", value: 6000 + n * 31, unit: "/µL", ref: "4000–11000", flag: "normal" },
        ],
        uploaded_at: iso(new Date(when.getTime() + 864e5)),
      });
    }
  }
}

// ── Today's clinic for Dr. Anita — the doctor console's landing view ──
const TODAY_QUEUE: [number, number, string, Appointment["status"]][] = [
  [1, 9, "Follow-up: sugar review", "checked_in"],
  [2, 10, "Swelling of both feet for 4 days", "checked_in"],
  [4, 11, "Tiredness and giddiness", "confirmed"],
  [5, 12, "Acidity, worse at night", "confirmed"],
  [3, 17, "Cough at night, 2 weeks", "confirmed"],
];
TODAY_QUEUE.forEach(([pi, hour, reason, status], i) => {
  const start = istInstant(istDay(), `${String(hour).padStart(2, "0")}:${(i % 2) * 30 === 0 ? "00" : "30"}`);
  appointments.push({
    id: `today-${i + 1}`, token_no: i + 1, patient_id: P(pi),
    doctor_id: D(1), hospital_id: H(1),
    slot_start: iso(start), slot_end: iso(new Date(start.getTime() + 15 * 60000)),
    status, reason, mode: "in_person",
    created_at: iso(daysAgo(2)), cancelled_at: null, cancel_reason: null,
  });
});

// Two upcoming appointments so the patient's Appointments tab is not empty
[[1, 6, D(2), H(1), "Chest discomfort on climbing stairs"],
 [1, 20, D(1), H(1), "Quarterly diabetes review"]].forEach((r, i) => {
  const start = daysAgo(-(r[1] as number), 11);
  appointments.push({
    id: `up-${i + 1}`, token_no: null, patient_id: P(r[0] as number),
    doctor_id: r[2] as string, hospital_id: r[3] as string,
    slot_start: iso(start), slot_end: iso(new Date(start.getTime() + 15 * 60000)),
    status: "confirmed", reason: r[4] as string, mode: "in_person",
    created_at: iso(daysAgo(3)), cancelled_at: null, cancel_reason: null,
  });
});

export const dailyCheckins: DailyCheckin[] = [];
for (const pi of [1, 2]) {
  for (let g = 0; g < 90; g++) {
    if (g % 11 === 7) continue; // people miss days
    dailyCheckins.push({
      id: `dc-${pi}-${g}`, patient_id: P(pi),
      log_date: iso(daysAgo(g)).slice(0, 10),
      mood: 1 + Math.floor(rand(g + pi * 100) * 5),
      energy: 1 + Math.floor(rand(g + pi * 200) * 5),
      sleep_hours: Math.round((5 + rand(g + pi * 300) * 4) * 10) / 10,
      pain_score: Math.floor(rand(g + pi * 400) * 6),
      symptoms: g % 7 === 0 ? ["headache"] : g % 5 === 0 ? ["fatigue", "giddiness"] : [],
      meds_taken: g % 9 !== 0,
      water_glasses: 4 + Math.floor(rand(g + pi * 500) * 5),
      notes: null,
    });
  }
}

export const deviceReadings: DeviceReading[] = [];
for (let g = 0; g < 30; g++) {
  const at = iso(daysAgo(g, 21));
  deviceReadings.push(
    { patient_id: P(1), provider: "google_fit", metric: "steps", value: 2800 + Math.floor(rand(g) * 6400), unit: "count", measured_at: at },
    { patient_id: P(1), provider: "google_fit", metric: "heart_rate", value: 61 + Math.floor(rand(g + 50) * 16), unit: "bpm", measured_at: at },
    { patient_id: P(1), provider: "google_fit", metric: "sleep_minutes", value: 330 + Math.floor(rand(g + 90) * 150), unit: "minutes", measured_at: at },
    { patient_id: P(1), provider: "google_fit", metric: "spo2", value: 95 + Math.floor(rand(g + 130) * 4), unit: "%", measured_at: at },
  );
}

/** Seeded care relationships, so the demo doctor opens a record on the
 *  first click and the "request access" flow is a deliberate choice. */
export const careRelationships: CareRelationship[] = [
  {
    id: "cr-1", patient_id: P(1), doctor_id: D(1), basis: "appointment",
    scope: ["demographics", "diagnoses", "prescriptions", "reports", "wellness"],
    granted_at: iso(daysAgo(3)), expires_at: iso(daysAgo(-27)),
    revoked_at: null, granted_via: "Appointment on " + iso(daysAgo(3)).slice(0, 10),
  },
  {
    id: "cr-2", patient_id: P(2), doctor_id: D(1), basis: "appointment",
    scope: ["demographics", "diagnoses", "prescriptions", "reports"],
    granted_at: iso(daysAgo(1)), expires_at: iso(daysAgo(-29)),
    revoked_at: null, granted_via: "Appointment on " + iso(daysAgo(1)).slice(0, 10),
  },
  {
    id: "cr-3", patient_id: P(1), doctor_id: D(2), basis: "patient_consent",
    scope: ["demographics", "diagnoses", "reports"],
    granted_at: iso(daysAgo(40)), expires_at: iso(daysAgo(10)),
    revoked_at: null, granted_via: "OTP approval",
  },
  {
    // Deliberately close to lapsing, so the doctor's "expiring this week"
    // card has something real to show. Consent that runs out quietly is the
    // failure mode that card exists to prevent.
    id: "cr-4", patient_id: P(4), doctor_id: D(1), basis: "patient_consent",
    scope: ["demographics", "diagnoses", "prescriptions", "reports"],
    granted_at: iso(daysAgo(27)), expires_at: iso(daysAgo(-3)),
    revoked_at: null, granted_via: "OTP approval",
  },
];

export const ids = { H, D, P };
