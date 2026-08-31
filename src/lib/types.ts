// Domain types. These mirror the Postgres schema in supabase/migrations
// one-for-one; when you run `supabase gen types typescript --linked`
// the generated file should agree with this by construction.

export type UserRole = "patient" | "doctor" | "admin";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";
export type SexAtBirth = "male" | "female" | "intersex" | "undisclosed";
export type ApptStatus =
  | "requested" | "confirmed" | "checked_in" | "in_consult"
  | "completed" | "cancelled" | "no_show";
export type CaseStatus = "draft" | "finalized" | "amended";
export type DonorStatus = "registered" | "not_registered" | "undisclosed";
export type RelBasis = "appointment" | "patient_consent" | "emergency_override" | "referral";

export type Scope = "demographics" | "diagnoses" | "prescriptions" | "reports" | "billing" | "wellness";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_path: string | null;
  preferred_locale: string;
}

export interface Hospital {
  id: string;
  name: string;
  hfr_id: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  phone: string;
  emergency_phone: string | null;
}

export interface Specialization { id: number; name: string; name_hi: string }

export interface Doctor {
  id: string;
  registration_no: string;
  hpr_id: string | null;
  qualifications: string[];
  specialization_id: number;
  sub_specialty: string | null;
  experience_years: number;
  languages: string[];
  bio: string | null;
  awards: { title: string; year: number; body: string }[];
  consultation_fee: number;
  verified_at: string | null;
}

export interface Patient {
  id: string;
  mrn: string;
  abha_number: string | null;
  abha_address: string | null;
  date_of_birth: string;
  sex: SexAtBirth;
  gender_identity: string | null;
  blood_group: BloodGroup;
  height_cm: number | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  organ_donor: DonorStatus;
  organ_donor_ref: string | null;
}

export interface DoctorAvailability {
  id: string;
  doctor_id: string;
  hospital_id: string;
  weekday: number;
  start_time: string; // "09:00"
  end_time: string;   // "13:00"
  slot_minutes: number;
}

export interface AvailabilityException {
  id: string;
  doctor_id: string;
  from: string;
  to: string;
  reason: string;
}

export interface Appointment {
  id: string;
  token_no: number | null;
  patient_id: string;
  doctor_id: string;
  hospital_id: string;
  slot_start: string; // ISO
  slot_end: string;
  status: ApptStatus;
  reason: string | null;
  mode: "in_person" | "teleconsult";
  created_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

// ── The case sheet: fixed clinical concepts get real columns, the
//    free-form parts of the history get typed JSON. ────────────────

export interface ChiefComplaint {
  complaint: string;
  duration_value: number;
  duration_unit: "hours" | "days" | "weeks" | "months" | "years";
}

export interface Hopi {
  onset?: string;
  location?: string;
  duration?: string;
  character?: string;
  aggravating?: string;
  relieving?: string;
  radiation?: string;
  timing?: string;
  severity_0_10?: number;
  associated?: string[];
  progression?: string;
}

export type TriState = "present" | "absent" | "not_examined";

export interface GeneralExam {
  pallor?: TriState;
  icterus?: TriState;
  cyanosis?: TriState;
  clubbing?: TriState;
  lymphadenopathy?: TriState;
  oedema?: TriState;
  dehydration?: TriState;
  build?: string;
}

export interface SystemExam {
  inspection?: string;
  palpation?: string;
  percussion?: string;
  auscultation?: string;
  wnl?: boolean;
}

export interface SystemicExam {
  cvs?: SystemExam;
  respiratory?: SystemExam;
  abdomen?: SystemExam;
  cns?: SystemExam;
  msk?: SystemExam;
}

export interface PastHistory {
  diabetes?: { present: boolean; since?: string; on_treatment?: boolean };
  hypertension?: { present: boolean; since?: string; on_treatment?: boolean };
  tuberculosis?: { present: boolean; since?: string; on_treatment?: boolean };
  asthma?: { present: boolean; since?: string; on_treatment?: boolean };
  thyroid?: { present: boolean; since?: string; on_treatment?: boolean };
  ihd?: { present: boolean; since?: string; on_treatment?: boolean };
  cva?: { present: boolean; since?: string; on_treatment?: boolean };
  epilepsy?: { present: boolean; since?: string; on_treatment?: boolean };
  hepatitis?: { present: boolean; since?: string; on_treatment?: boolean };
  notes?: string;
}

export interface PersonalHistory {
  diet?: "veg" | "non_veg" | "eggetarian" | "vegan";
  appetite?: "normal" | "reduced" | "increased";
  sleep?: "normal" | "disturbed" | "insomnia";
  bowel?: "regular" | "constipated" | "loose";
  bladder?: "normal" | "frequency" | "dysuria" | "nocturia";
  tobacco?: { use: boolean; qty_per_day?: number; years?: number; pack_years?: number };
  alcohol?: { use: boolean; units_per_week?: number; years?: number };
  other_substances?: string;
  occupation?: string;
  exercise?: string;
}

export interface MenstrualObstetric {
  lmp?: string;
  cycle?: string;
  parity?: string;
  obstetric_score?: string;
}

export interface CaseSheet {
  id: string;
  patient_id: string;
  doctor_id: string;
  hospital_id: string;
  appointment_id: string | null;
  visit_type: "opd" | "followup" | "emergency" | "ipd";
  chief_complaints: ChiefComplaint[];
  hopi: Hopi;
  past_history: PastHistory;
  personal_history: PersonalHistory;
  menstrual_obstetric: MenstrualObstetric | null;
  treatment_history: string | null;
  general_exam: GeneralExam;
  systemic_exam: SystemicExam;
  provisional_dx: string | null;
  differential_dx: string[];
  advice: string | null;
  follow_up_on: string | null;
  referred_to: string | null;
  status: CaseStatus;
  finalized_at: string | null;
  ai_summary: string | null;
  amends_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Diagnosis {
  id: string;
  case_sheet_id: string;
  patient_id: string;
  icd11_code: string | null;
  icd11_title: string | null;
  free_text: string | null;
  certainty: "provisional" | "confirmed" | "ruled_out";
  is_chronic: boolean;
  onset_date: string | null;
}

export interface Vitals {
  id: string;
  patient_id: string;
  case_sheet_id: string | null;
  recorded_at: string;
  source: "clinic" | "device" | "self";
  temperature_c: number | null;
  pulse_bpm: number | null;
  resp_rate: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  spo2: number | null;
  weight_kg: number | null;
  random_glucose: number | null;
  pain_score: number | null;
}

export interface InvestigationOrder {
  id: string;
  case_sheet_id: string;
  patient_id: string;
  test_name: string;
  panel: string | null;
  urgency: "routine" | "urgent" | "stat";
  clinical_note: string | null;
  ordered_at: string;
  status: "ordered" | "collected" | "reported";
}

export interface Drug {
  id: number;
  brand_name: string | null;
  generic_name: string;
  strength: string | null;
  form: string | null;
  schedule: string | null;
  class: string | null;
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  drug_id: number | null;
  drug_text: string;
  dose: string;
  frequency: string;
  route: string;
  timing: string | null;
  duration_days: number | null;
  quantity: number | null;
  instructions: string | null;
}

export interface Prescription {
  id: string;
  case_sheet_id: string;
  patient_id: string;
  doctor_id: string;
  issued_at: string;
  verify_token: string;
  items: PrescriptionItem[];
}

export interface PatientMedication {
  id: string;
  patient_id: string;
  prescription_item_id: string | null;
  drug_text: string;
  dose: string | null;
  frequency: string | null;
  started_on: string;
  ended_on: string | null;
  is_self_reported: boolean;
  adherence_pct: number | null;
}

export interface Allergy {
  id: string;
  patient_id: string;
  allergen: string;
  category: "drug" | "food" | "environmental";
  reaction: string | null;
  severity: "mild" | "moderate" | "severe" | "anaphylaxis";
  recorded_by: string | null;
  recorded_at: string;
}

export interface SurgicalHistory {
  id: string;
  patient_id: string;
  procedure_name: string;
  performed_on: string | null;
  hospital_name: string | null;
  surgeon_name: string | null;
  anaesthesia: string | null;
  complications: string | null;
  is_self_reported: boolean;
}

export interface FamilyHistory {
  id: string;
  patient_id: string;
  relation: string;
  condition: string;
  age_at_onset: number | null;
}

export interface ChronicCondition {
  id: string;
  patient_id: string;
  condition: string;
  icd11_code: string | null;
  since: string | null;
  on_treatment: boolean;
}

export interface ExtractedValue {
  analyte: string;
  value: number;
  unit: string;
  ref: string;
  flag: "low" | "normal" | "high";
}

export interface DocumentRecord {
  id: string;
  patient_id: string;
  case_sheet_id: string | null;
  kind: "lab_report" | "imaging" | "discharge" | "rx" | "insurance";
  title: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  report_date: string;
  ordering_doctor: string | null;
  ocr_text: string | null;
  extracted_values: ExtractedValue[] | null;
  uploaded_at: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  category: "consultation" | "pharmacy" | "lab" | "imaging" | "procedure" | "room";
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
}

export interface Bill {
  id: string;
  patient_id: string;
  hospital_id: string;
  case_sheet_id: string | null;
  bill_no: string;
  billed_on: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  insurance_covered: number;
  patient_payable: number;
  status: "paid" | "unpaid" | "partial";
  items: BillItem[];
}

export interface InsurancePolicy {
  id: string;
  patient_id: string;
  insurer: string;
  policy_no: string;
  scheme: string;
  sum_insured: number;
  valid_from: string;
  valid_to: string;
  tpa_name: string | null;
  tpa_phone: string | null;
  used: number;
}

export interface DailyCheckin {
  id: string;
  patient_id: string;
  log_date: string;
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  pain_score: number | null;
  symptoms: string[];
  meds_taken: boolean | null;
  water_glasses: number | null;
  notes: string | null;
}

export interface DeviceReading {
  patient_id: string;
  provider: string;
  metric: "steps" | "heart_rate" | "sleep_minutes" | "spo2" | "calories";
  value: number;
  unit: string;
  measured_at: string;
}

export interface EmergencyContact {
  id: string;
  patient_id: string;
  name: string;
  relation: string;
  phone: string;
  is_primary: boolean;
}

export interface EmergencyCard {
  id: string;
  patient_id: string;
  token: string;
  issued_at: string;
  revoked_at: string | null;
}

export interface CareRelationship {
  id: string;
  patient_id: string;
  doctor_id: string;
  basis: RelBasis;
  scope: Scope[];
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
  granted_via: string | null;
}

export interface AccessAuditRow {
  id: number;
  actor_id: string;
  actor_role: UserRole;
  patient_id: string;
  action: "view" | "create" | "amend" | "export" | "override";
  resource: string;
  resource_id: string | null;
  basis: RelBasis | null;
  at: string;
}

export interface AccessRequest {
  id: string;
  patient_id: string;
  doctor_id: string;
  otp: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
}

export interface Slot {
  start: string;
  end: string;
  hospital_id: string;
}
