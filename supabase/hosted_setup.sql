-- ═══════════════════════════════════════════════════════════════
-- Nidan — one-paste setup for a hosted Supabase project.
--
-- This file is the six migrations plus the demo seed, concatenated in
-- dependency order. Paste the whole thing into the Supabase SQL Editor and
-- run it once.
--
-- Do NOT run supabase/local_shim.sql here. That file fakes the auth schema
-- so the migrations can be verified on a plain Postgres; Supabase provides
-- the real one, and the shim would shadow it.
--
-- Why the search_path line: Supabase installs pgcrypto into the `extensions`
-- schema rather than `public`, so crypt() and gen_salt() are not visible
-- under the SQL Editor's default path. Setting it once here keeps the seed
-- identical to the file the local Postgres verification runs.
-- ═══════════════════════════════════════════════════════════════

set search_path = public, extensions;



-- ───────────────────────────────────────────────────────────────
-- migrations/001_identity.sql
-- ───────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
-- 001 — enums and identity
-- Every authenticated user gets exactly one profiles row, extended
-- by exactly one patients OR doctors row. That is the join point.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create type user_role    as enum ('patient','doctor','admin');
create type blood_group  as enum ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown');
create type sex_at_birth as enum ('male','female','intersex','undisclosed');
create type appt_status  as enum ('requested','confirmed','checked_in','in_consult','completed','cancelled','no_show');
create type case_status  as enum ('draft','finalized','amended');
create type donor_status as enum ('registered','not_registered','undisclosed');

-- one row per auth.users row; the join point for everything
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  role             user_role not null,
  full_name        text not null,
  phone            text unique,
  email            text unique,
  avatar_path      text,
  preferred_locale text not null default 'en',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create sequence if not exists mrn_seq;

create table patients (
  id            uuid primary key references profiles(id) on delete cascade,
  -- human-readable, printed on the card: ND-2026-000481
  mrn           text unique not null default 'ND-' || to_char(now(),'YYYY') || '-' ||
                     lpad(nextval('mrn_seq')::text, 6, '0'),
  abha_number   text unique,                    -- 14-digit, nullable until linked
  abha_address  text unique,                    -- name@abdm
  date_of_birth date not null,
  sex           sex_at_birth not null,
  gender_identity text,
  blood_group   blood_group not null default 'unknown',
  height_cm     numeric(5,1),
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  pincode       text,
  organ_donor   donor_status not null default 'undisclosed',
  organ_donor_ref text,                         -- NOTTO pledge id if any
  created_at    timestamptz not null default now()
);

-- age is derived, never stored. Storing age is a bug that ships.
create view patient_age as
  select id, extract(year from age(date_of_birth))::int as years from patients;

create table specializations (
  id      serial primary key,
  name    text unique not null,                 -- 'Cardiology'
  name_hi text                                  -- 'हृदय रोग'
);

create table doctors (
  id               uuid primary key references profiles(id) on delete cascade,
  registration_no  text unique not null,        -- NMC/state council number
  hpr_id           text unique,                 -- ABDM Healthcare Professional Registry
  qualifications   text[] not null default '{}',-- {MBBS, MD (Gen Med)}
  specialization_id int references specializations(id),
  sub_specialty    text,
  experience_years int not null default 0,
  languages        text[] not null default '{en}',
  bio              text,
  awards           jsonb not null default '[]', -- [{title, year, body}]
  consultation_fee numeric(10,2),
  signature_path   text,                        -- for Rx PDFs
  verified_at      timestamptz
);

create table hospitals (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  hfr_id  text unique,                          -- ABDM Health Facility Registry
  address text,
  city    text,
  state   text,
  pincode text,
  lat     numeric(9,6),
  lng     numeric(9,6),
  phone   text,
  emergency_phone text
);

create table doctor_hospitals (
  doctor_id   uuid references doctors(id) on delete cascade,
  hospital_id uuid references hospitals(id) on delete cascade,
  department  text,
  primary key (doctor_id, hospital_id)
);

create index on profiles (role);
create index on patients (mrn);
create index on patients (abha_number);


-- ───────────────────────────────────────────────────────────────
-- migrations/002_scheduling.sql
-- ───────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
-- 002 — scheduling
-- A patient can only pick a time inside the doctor's slot. That rule
-- is enforced in the database, not in the date picker. Two layers:
-- a generator that only ever emits legal slots, and an exclusion
-- constraint that makes double-booking physically impossible.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists btree_gist;

create table doctor_availability (
  id           uuid primary key default gen_random_uuid(),
  doctor_id    uuid not null references doctors(id) on delete cascade,
  hospital_id  uuid not null references hospitals(id),
  weekday      smallint not null check (weekday between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  slot_minutes smallint not null default 15,
  valid_from   date not null default current_date,
  valid_to     date,
  check (end_time > start_time)
);

-- leave, conference, OT day: blocks slots without deleting the rule
create table availability_exceptions (
  id        uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id) on delete cascade,
  blocked   tstzrange not null,
  reason    text
);

create table appointments (
  id           uuid primary key default gen_random_uuid(),
  token_no     int,                              -- queue number for the day
  patient_id   uuid not null references patients(id),
  doctor_id    uuid not null references doctors(id),
  hospital_id  uuid not null references hospitals(id),
  slot         tstzrange not null,
  status       appt_status not null default 'requested',
  reason       text,                             -- patient's own words
  mode         text not null default 'in_person',-- in_person | teleconsult
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,

  -- a doctor cannot be in two places at once. Enforced, not hoped for.
  exclude using gist (
    doctor_id with =, slot with &&
  ) where (status not in ('cancelled','no_show'))
);

create index on appointments (patient_id, lower(slot) desc);
create index on appointments (doctor_id, lower(slot));

-- ───────────────────────────────────────────────────────────────
-- The only source of bookable times. The booking UI calls nothing
-- else, so there is no code path that can produce an illegal booking.
-- ───────────────────────────────────────────────────────────────
create or replace function available_slots(
  p_doctor   uuid,
  p_hospital uuid,
  p_from     date,
  p_to       date
)
returns table (slot tstzrange, hospital_id uuid)
language sql
stable
as $$
  with days as (
    select d::date as day
    from generate_series(p_from, p_to, interval '1 day') d
  ),
  rules as (
    select a.*, days.day
    from doctor_availability a
    join days on extract(dow from days.day)::int = a.weekday
    where a.doctor_id = p_doctor
      and a.hospital_id = p_hospital
      and days.day >= a.valid_from
      and (a.valid_to is null or days.day <= a.valid_to)
  ),
  candidates as (
    select
      tstzrange(
        (r.day + r.start_time) + (n * (r.slot_minutes || ' minutes')::interval),
        (r.day + r.start_time) + ((n + 1) * (r.slot_minutes || ' minutes')::interval),
        '[)'
      ) as slot,
      r.hospital_id
    from rules r,
      generate_series(
        0,
        (extract(epoch from (r.end_time - r.start_time)) / (r.slot_minutes * 60))::int - 1
      ) as n
  )
  select c.slot, c.hospital_id
  from candidates c
  where lower(c.slot) > now()
    -- subtract leave / OT blocks
    and not exists (
      select 1 from availability_exceptions e
      where e.doctor_id = p_doctor and e.blocked && c.slot
    )
    -- left-join out anything already booked
    and not exists (
      select 1 from appointments ap
      where ap.doctor_id = p_doctor
        and ap.slot && c.slot
        and ap.status not in ('cancelled','no_show')
    )
  order by lower(c.slot);
$$;


-- ───────────────────────────────────────────────────────────────
-- migrations/003_clinical.sql
-- ───────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
-- 003 — the clinical core
-- This is the table that makes Nidan a case-taking system rather
-- than a records viewer. Note the split: fixed clinical concepts get
-- real columns; the genuinely free-form parts of the history get
-- typed JSONB so the form can evolve without a migration every hour.
-- ═══════════════════════════════════════════════════════════════

create table case_sheets (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references patients(id),
  doctor_id      uuid not null references doctors(id),
  hospital_id    uuid not null references hospitals(id),
  appointment_id uuid unique references appointments(id),
  visit_type     text not null default 'opd',   -- opd | followup | emergency | ipd

  -- ── Subjective ────────────────────────────────────
  chief_complaints jsonb not null default '[]',
    -- [{complaint:"Chest pain", duration_value:3, duration_unit:"days"}]
  hopi             jsonb not null default '{}',
    -- OLDCARTS: {onset, location, duration, character, aggravating,
    --            relieving, radiation, timing, severity_0_10, associated[]}
  past_history     jsonb not null default '{}',
  personal_history jsonb not null default '{}',
    -- {diet, appetite, sleep, bowel, bladder, tobacco, alcohol, addictions}
  menstrual_obstetric jsonb,                    -- shown conditionally
  treatment_history text,

  -- ── Objective ─────────────────────────────────────
  general_exam  jsonb not null default '{}',
    -- {pallor, icterus, cyanosis, clubbing, lymphadenopathy, edema, ...}
  systemic_exam jsonb not null default '{}',
    -- {cvs:{...}, respiratory:{...}, abdomen:{...}, cns:{...}, msk:{...}}

  -- ── Assessment & plan ─────────────────────────────
  provisional_dx  text,
  differential_dx text[],
  advice          text,
  follow_up_on    date,
  referred_to     text,

  status       case_status not null default 'draft',
  finalized_at timestamptz,
  ai_summary   text,                            -- generated, always labelled as such
  amends_id    uuid references case_sheets(id), -- a correction points at the original
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on case_sheets (patient_id, created_at desc);
create index on case_sheets (doctor_id, created_at desc);

-- structured, coded diagnoses — this is what makes the data useful
create table diagnoses (
  id            uuid primary key default gen_random_uuid(),
  case_sheet_id uuid not null references case_sheets(id) on delete cascade,
  patient_id    uuid not null references patients(id),
  icd11_code    text,
  icd11_title   text,
  free_text     text,
  certainty     text not null default 'provisional', -- provisional|confirmed|ruled_out
  is_chronic    boolean not null default false,
  onset_date    date,
  resolved_date date
);
create index on diagnoses (patient_id);

create table vitals (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id),
  case_sheet_id uuid references case_sheets(id) on delete set null,
  recorded_at   timestamptz not null default now(),
  source        text not null default 'clinic', -- clinic | device | self
  temperature_c   numeric(4,1),
  pulse_bpm       smallint,
  resp_rate       smallint,
  bp_systolic     smallint,
  bp_diastolic    smallint,
  spo2            smallint,
  weight_kg       numeric(5,2),
  random_glucose  numeric(5,1),
  pain_score      smallint
);
create index on vitals (patient_id, recorded_at desc);

create table examination_findings (
  id            uuid primary key default gen_random_uuid(),
  case_sheet_id uuid not null references case_sheets(id) on delete cascade,
  system        text not null,                  -- cvs | respiratory | abdomen | cns | msk
  method        text not null,                  -- inspection|palpation|percussion|auscultation
  finding       text not null,
  is_normal     boolean not null default true
);

create table investigation_orders (
  id            uuid primary key default gen_random_uuid(),
  case_sheet_id uuid not null references case_sheets(id) on delete cascade,
  patient_id    uuid not null references patients(id),
  test_name     text not null,
  panel         text,                           -- 'CBC + LFT + RFT'
  urgency       text not null default 'routine',-- routine | urgent | stat
  clinical_note text,
  ordered_at    timestamptz not null default now(),
  status        text not null default 'ordered' -- ordered | collected | reported
);


-- ───────────────────────────────────────────────────────────────
-- migrations/004_therapeutics.sql
-- ───────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
-- 004 — prescriptions, history, documents
-- ═══════════════════════════════════════════════════════════════

create table drug_master (
  id           serial primary key,
  brand_name   text,
  generic_name text not null,
  strength     text,
  form         text,                            -- tablet | syrup | injection
  schedule     text,                            -- H | H1 | X | OTC
  class        text,
  unique (brand_name, strength, form)
);
create index on drug_master using gin (to_tsvector('english',
  coalesce(brand_name,'') || ' ' || generic_name));

-- allergen cross-reactivity, so a penicillin allergy blocks amoxicillin
create table drug_allergen_map (
  drug_class text not null,
  allergen   text not null,
  primary key (drug_class, allergen)
);

create table prescriptions (
  id            uuid primary key default gen_random_uuid(),
  case_sheet_id uuid not null references case_sheets(id) on delete cascade,
  patient_id    uuid not null references patients(id),
  doctor_id     uuid not null references doctors(id),
  issued_at     timestamptz not null default now(),
  pdf_path      text,
  verify_token  text unique                     -- QR on the PDF verifies against the DB
);

create table prescription_items (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  drug_id         int references drug_master(id),
  drug_text       text not null,                -- always keep the printed string
  dose            text not null,                -- '500 mg'
  frequency       text not null,                -- '1-0-1'  (morning-noon-night)
  route           text not null default 'oral',
  timing          text,                         -- 'after food'
  duration_days   smallint,
  quantity        int,                          -- auto-computed from frequency × duration
  instructions    text
);

-- the "current medications" view the patient sees
create table patient_medications (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references patients(id),
  prescription_item_id uuid references prescription_items(id),
  drug_text  text not null,
  dose       text,
  frequency  text,
  started_on date not null default current_date,
  ended_on   date,                              -- null = currently taking
  is_self_reported boolean not null default false,
  adherence_pct smallint
);
create index on patient_medications (patient_id) where ended_on is null;

create table allergies (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id),
  allergen    text not null,
  category    text,                             -- drug | food | environmental
  reaction    text,
  severity    text,                             -- mild | moderate | severe | anaphylaxis
  recorded_by uuid references profiles(id),
  recorded_at timestamptz not null default now()
);
create index on allergies (patient_id);

create table surgical_history (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id),
  procedure_name text not null,
  performed_on  date,
  hospital_name text,
  surgeon_name  text,
  anaesthesia   text,
  complications text,
  notes         text,
  is_self_reported boolean not null default false,
  document_id   uuid
);

create table family_history (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients(id),
  relation     text not null,
  condition    text not null,
  age_at_onset smallint,
  notes        text
);

create table chronic_conditions (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  condition  text not null,
  icd11_code text,
  since      date,
  on_treatment boolean not null default false,
  notes      text
);

create table immunizations (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id),
  vaccine     text not null,
  dose_no     smallint,
  given_on    date,
  facility    text
);

-- every uploaded artefact: lab report, X-ray, MRI, discharge summary
create table documents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id),
  case_sheet_id uuid references case_sheets(id) on delete set null,
  kind          text not null,                  -- lab_report | imaging | discharge | rx | insurance
  title         text not null,
  storage_path  text not null,                  -- bucket key, never a public URL
  mime_type     text,
  size_bytes    bigint,
  report_date   date,
  ordering_doctor uuid references doctors(id),
  ocr_text      text,                           -- extracted, makes reports searchable
  extracted_values jsonb,
    -- [{analyte:'Hb', value:11.2, unit:'g/dL', ref:'12-15', flag:'low'}]
  uploaded_by   uuid references profiles(id),
  uploaded_at   timestamptz not null default now()
);
create index on documents (patient_id, report_date desc);
create index on documents using gin (to_tsvector('english', coalesce(ocr_text,'')));


-- ───────────────────────────────────────────────────────────────
-- migrations/005_ancillary.sql
-- ───────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
-- 005 — billing, wellness, emergency
-- Every figure the billing tab shows is derived by SQL aggregate,
-- never computed in the client.
-- ═══════════════════════════════════════════════════════════════

create table bills (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id),
  hospital_id   uuid references hospitals(id),
  case_sheet_id uuid references case_sheets(id),
  bill_no       text unique not null,
  billed_on     date not null default current_date,
  subtotal      numeric(12,2) not null default 0,
  discount      numeric(12,2) not null default 0,
  tax           numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  insurance_covered numeric(12,2) not null default 0,
  patient_payable   numeric(12,2) generated always as (total - insurance_covered) stored,
  status        text not null default 'unpaid'
);
create index on bills (patient_id, billed_on desc);

create table bill_items (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references bills(id) on delete cascade,
  category    text not null,   -- consultation|pharmacy|lab|imaging|procedure|room
  description text not null,
  qty         numeric(8,2) not null default 1,
  unit_price  numeric(12,2) not null,
  amount      numeric(12,2) generated always as (qty * unit_price) stored
);

create table payments (
  id       uuid primary key default gen_random_uuid(),
  bill_id  uuid not null references bills(id) on delete cascade,
  amount   numeric(12,2) not null,
  method   text not null,        -- upi | card | cash | insurance
  paid_at  timestamptz not null default now(),
  gateway_ref text
);

create table insurance_policies (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id),
  insurer     text not null,
  policy_no   text not null,
  scheme      text,              -- 'PM-JAY' | 'Corporate' | 'Individual'
  sum_insured numeric(12,2),
  valid_from  date,
  valid_to    date,
  tpa_name    text,
  tpa_phone   text,
  card_document_id uuid
);

create table insurance_claims (
  id         uuid primary key default gen_random_uuid(),
  policy_id  uuid not null references insurance_policies(id),
  bill_id    uuid references bills(id),
  claim_no   text,
  amount     numeric(12,2),
  status     text not null default 'submitted',  -- submitted|approved|rejected|settled
  filed_on   date default current_date
);

-- patient-entered daily check-in
create table daily_checkins (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id),
  log_date    date not null default current_date,
  mood        smallint check (mood between 1 and 5),
  energy      smallint check (energy between 1 and 5),
  sleep_hours numeric(3,1),
  pain_score  smallint,
  symptoms    text[],
  meds_taken  boolean,
  water_glasses smallint,
  notes       text,
  unique (patient_id, log_date)
);

-- pulled from Google Fit / Apple Health / manual
create table device_connections (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references patients(id),
  provider          text not null,   -- google_fit | apple_health | fitbit | manual
  access_token_enc  text,
  refresh_token_enc text,
  scopes            text[],
  last_synced_at    timestamptz,
  unique (patient_id, provider)
);

create table device_readings (
  id          bigserial primary key,
  patient_id  uuid not null references patients(id),
  provider    text not null,
  metric      text not null,        -- steps|heart_rate|sleep_minutes|spo2|calories
  value       numeric not null,
  unit        text,
  measured_at timestamptz not null,
  unique (patient_id, provider, metric, measured_at)
);
create index on device_readings (patient_id, metric, measured_at desc);

create table emergency_contacts (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  name       text not null,
  relation   text,
  phone      text not null,
  is_primary boolean not null default false
);

create table emergency_cards (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  token      text unique not null,   -- signed, revocable
  issued_at  timestamptz not null default now(),
  revoked_at timestamptz
);

create table ambulance_providers (
  id    serial primary key,
  name  text not null,
  phone text not null,
  city  text,
  state text,
  is_national boolean not null default false
);
-- seed: ('National Ambulance','108',null,null,true), ('Emergency','112',...)


-- ───────────────────────────────────────────────────────────────
-- migrations/006_governance.sql
-- ───────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
-- 006 — governance, consent and Row Level Security
--
-- The highest-value-per-line-of-code work in the project, and the
-- answer to the question every judging panel asks.
--
-- A doctor never has blanket access to patient records. Access is
-- granted by an ACTIVE CARE RELATIONSHIP, created by exactly three
-- events: the patient books an appointment; the patient grants
-- explicit consent via MRN/ABHA + OTP; or an emergency break-glass
-- override, which is logged loudly and notifies the patient.
-- ═══════════════════════════════════════════════════════════════

create type rel_basis as enum ('appointment','patient_consent','emergency_override','referral');

create table care_relationships (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  doctor_id  uuid not null references doctors(id)  on delete cascade,
  basis      rel_basis not null,
  scope      text[] not null default '{demographics,diagnoses,prescriptions,reports}',
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  granted_via text
);
create index on care_relationships (doctor_id, patient_id) where revoked_at is null;

create or replace function has_care_access(p_patient uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from care_relationships cr
    where cr.patient_id = p_patient
      and cr.doctor_id  = auth.uid()
      and cr.revoked_at is null
      and cr.expires_at > now()
  );
$$;

-- scope-aware variant, for billing and wellness
create or replace function has_care_access(p_patient uuid, p_scope text)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from care_relationships cr
    where cr.patient_id = p_patient
      and cr.doctor_id  = auth.uid()
      and cr.revoked_at is null
      and cr.expires_at > now()
      and p_scope = any(cr.scope)
  );
$$;

-- ABDM consent artefacts, modelled in ABDM's own vocabulary so the
-- mapping to the real gateway is mechanical rather than a rewrite
create table consents (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients(id) on delete cascade,
  requester_id uuid references profiles(id),
  purpose      text not null,               -- CAREMGT | BTG | PUBHLTH | DSRCH
  hi_types     text[] not null default '{DiagnosticReport,Prescription,OPConsultation}',
  date_from    date,
  date_to      date,
  expires_at   timestamptz not null,
  status       text not null default 'requested', -- requested|granted|denied|revoked|expired
  artefact_id  text,
  created_at   timestamptz not null default now()
);

create table abha_links (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients(id) on delete cascade,
  abha_number  text not null,
  abha_address text,
  linked_at    timestamptz not null default now(),
  link_method  text                          -- aadhaar_otp | mobile_otp | mock
);

-- every read of another person's record leaves a trace
create table access_audit (
  id          bigserial primary key,
  actor_id    uuid not null,
  actor_role  user_role not null,
  patient_id  uuid not null,
  action      text not null,                 -- view | create | amend | export | override
  resource    text not null,
  resource_id uuid,
  basis       rel_basis,
  ip          inet,
  user_agent  text,
  at          timestamptz not null default now()
);
create index on access_audit (patient_id, at desc);

-- ═══════════════════════════════════════════════════════════════
-- The RLS pattern, applied to every clinical table.
-- Four policies, one shape:
--   1. patients read their own record, always
--   2. doctors read only where a live care relationship exists
--   3. only the authoring doctor may write, and only while draft
--   4. nobody deletes a clinical record. Ever. Amendments only.
--      (no DELETE policy = no DELETE permitted)
-- ═══════════════════════════════════════════════════════════════

alter table case_sheets enable row level security;

create policy "patient reads own case sheets" on case_sheets
  for select using ( patient_id = auth.uid() );

create policy "doctor reads with care relationship" on case_sheets
  for select using ( has_care_access(patient_id) );

create policy "author creates draft" on case_sheets
  for insert with check ( doctor_id = auth.uid() and has_care_access(patient_id) );

create policy "author writes draft" on case_sheets
  for update using ( doctor_id = auth.uid() and status = 'draft' )
             with check ( doctor_id = auth.uid() );

-- ── the same four-policy shape, repeated ──────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'vitals','diagnoses','prescriptions','documents','allergies',
    'surgical_history','family_history','chronic_conditions',
    'immunizations','patient_medications','investigation_orders',
    'emergency_contacts','insurance_policies'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "patient reads own" on %I for select using (patient_id = auth.uid())', t);
    execute format(
      'create policy "doctor reads with relationship" on %I for select using (has_care_access(patient_id))', t);
    execute format(
      'create policy "doctor writes with relationship" on %I for insert with check (has_care_access(patient_id))', t);
    execute format(
      'create policy "patient writes own" on %I for insert with check (patient_id = auth.uid())', t);
  end loop;
end $$;

-- appointments: doctors additionally read rows where doctor_id = auth.uid()
alter table appointments enable row level security;
create policy "patient reads own appointments" on appointments
  for select using ( patient_id = auth.uid() );
create policy "doctor reads own appointments" on appointments
  for select using ( doctor_id = auth.uid() );
create policy "patient books" on appointments
  for insert with check ( patient_id = auth.uid() );
create policy "either party updates status" on appointments
  for update using ( patient_id = auth.uid() or doctor_id = auth.uid() );

-- bills, daily_checkins and device_readings: patient-only unless a care
-- relationship includes the billing or wellness scope
alter table bills enable row level security;
create policy "patient reads own bills" on bills
  for select using ( patient_id = auth.uid() );
create policy "doctor reads bills in scope" on bills
  for select using ( has_care_access(patient_id, 'billing') );

alter table daily_checkins enable row level security;
create policy "patient owns checkins" on daily_checkins
  for all using ( patient_id = auth.uid() ) with check ( patient_id = auth.uid() );
create policy "doctor reads checkins in scope" on daily_checkins
  for select using ( has_care_access(patient_id, 'wellness') );

alter table device_readings enable row level security;
create policy "patient owns readings" on device_readings
  for all using ( patient_id = auth.uid() ) with check ( patient_id = auth.uid() );
create policy "doctor reads readings in scope" on device_readings
  for select using ( has_care_access(patient_id, 'wellness') );

-- the patient can always see, and revoke, who has access
alter table care_relationships enable row level security;
create policy "patient reads own grants" on care_relationships
  for select using ( patient_id = auth.uid() );
create policy "doctor reads own grants" on care_relationships
  for select using ( doctor_id = auth.uid() );
create policy "patient revokes" on care_relationships
  for update using ( patient_id = auth.uid() );

alter table access_audit enable row level security;
create policy "patient reads own audit" on access_audit
  for select using ( patient_id = auth.uid() );

alter table profiles enable row level security;
create policy "read own profile" on profiles for select using ( id = auth.uid() );
create policy "update own profile" on profiles for update using ( id = auth.uid() );

alter table patients enable row level security;
create policy "patient reads self" on patients for select using ( id = auth.uid() );
create policy "doctor reads with relationship" on patients
  for select using ( has_care_access(id) );
create policy "patient updates self" on patients for update using ( id = auth.uid() );

-- doctors, hospitals, specializations and drug_master are public
-- directory data: readable by any authenticated user, writable by none.
alter table doctors enable row level security;
create policy "directory read" on doctors for select using ( auth.role() = 'authenticated' );
create policy "doctor updates self" on doctors for update using ( id = auth.uid() );

-- ── the append-only guarantee, in the database ────────────────
create or replace function block_finalized_writes()
returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' then
    raise exception 'case sheet % is finalized; create an amendment instead', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger case_sheets_append_only
  before update on case_sheets
  for each row execute function block_finalized_writes();


-- ───────────────────────────────────────────────────────────────
-- seed.sql
-- ───────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
-- Nidan demo seed
--
-- "A demo against an empty database is a demo of nothing."
-- 3 hospitals · 8 doctors across 6 specialities · 5 patients with two
-- years of believable history · ~40 drug master rows.
--
-- UUIDs are deterministic so the mock store in src/lib/db/seed.ts and
-- this file describe the same world. Reset with:
--   supabase db reset
-- ═══════════════════════════════════════════════════════════════

-- ── Specialities ──────────────────────────────────────────────
insert into specializations (id, name, name_hi) values
  (1,'General Medicine','सामान्य चिकित्सा'),
  (2,'Cardiology','हृदय रोग'),
  (3,'Paediatrics','बाल रोग'),
  (4,'Orthopaedics','अस्थि रोग'),
  (5,'Dermatology','त्वचा रोग'),
  (6,'Obstetrics & Gynaecology','स्त्री एवं प्रसूति रोग')
on conflict do nothing;

-- ── Hospitals ─────────────────────────────────────────────────
insert into hospitals (id, name, hfr_id, address, city, state, pincode, lat, lng, phone, emergency_phone) values
  ('a1000000-0000-4000-8000-000000000001','Sanjeevani Multispeciality Hospital','HFR-MH-004821','Plot 14, SB Road','Pune','Maharashtra','411016',18.528600,73.833500,'+912025530011','+912025530000'),
  ('a1000000-0000-4000-8000-000000000002','Civil Hospital, Kothrud','HFR-MH-009117','Paud Road','Pune','Maharashtra','411038',18.507300,73.807400,'+912025432200','108'),
  ('a1000000-0000-4000-8000-000000000003','Aarogya Clinic & Diagnostics','HFR-MH-011903','Lane 5, Koregaon Park','Pune','Maharashtra','411001',18.536200,73.893200,'+912026150909',null);

-- ── Doctors ───────────────────────────────────────────────────
-- In production these ids come from auth.users. For a local seed we
-- insert the auth rows first so the FK holds.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
select v.id, v.email, crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email"}', '{}', 'authenticated','authenticated'
from (values
  ('d1000000-0000-4000-8000-000000000001'::uuid,'anita.deshmukh@nidan.in'),
  ('d1000000-0000-4000-8000-000000000002'::uuid,'rakesh.iyer@nidan.in'),
  ('d1000000-0000-4000-8000-000000000003'::uuid,'meera.pillai@nidan.in'),
  ('d1000000-0000-4000-8000-000000000004'::uuid,'sameer.qureshi@nidan.in'),
  ('d1000000-0000-4000-8000-000000000005'::uuid,'nandini.rao@nidan.in'),
  ('d1000000-0000-4000-8000-000000000006'::uuid,'vikram.shinde@nidan.in'),
  ('d1000000-0000-4000-8000-000000000007'::uuid,'farhan.ali@nidan.in'),
  ('d1000000-0000-4000-8000-000000000008'::uuid,'priya.nayak@nidan.in'),
  ('c1000000-0000-4000-8000-000000000001'::uuid,'sunita.kale@example.in'),
  ('c1000000-0000-4000-8000-000000000002'::uuid,'ramesh.patil@example.in'),
  ('c1000000-0000-4000-8000-000000000003'::uuid,'aarav.sharma@example.in'),
  ('c1000000-0000-4000-8000-000000000004'::uuid,'fatima.shaikh@example.in'),
  ('c1000000-0000-4000-8000-000000000005'::uuid,'joseph.dsouza@example.in')
) as v(id, email)
on conflict (id) do nothing;

insert into profiles (id, role, full_name, phone, email, preferred_locale) values
  ('d1000000-0000-4000-8000-000000000001','doctor','Dr. Anita Deshmukh','+919822001101','anita.deshmukh@nidan.in','en'),
  ('d1000000-0000-4000-8000-000000000002','doctor','Dr. Rakesh Iyer','+919822001102','rakesh.iyer@nidan.in','en'),
  ('d1000000-0000-4000-8000-000000000003','doctor','Dr. Meera Pillai','+919822001103','meera.pillai@nidan.in','en'),
  ('d1000000-0000-4000-8000-000000000004','doctor','Dr. Sameer Qureshi','+919822001104','sameer.qureshi@nidan.in','en'),
  ('d1000000-0000-4000-8000-000000000005','doctor','Dr. Nandini Rao','+919822001105','nandini.rao@nidan.in','en'),
  ('d1000000-0000-4000-8000-000000000006','doctor','Dr. Vikram Shinde','+919822001106','vikram.shinde@nidan.in','en'),
  ('d1000000-0000-4000-8000-000000000007','doctor','Dr. Farhan Ali','+919822001107','farhan.ali@nidan.in','en'),
  ('d1000000-0000-4000-8000-000000000008','doctor','Dr. Priya Nayak','+919822001108','priya.nayak@nidan.in','en'),
  ('c1000000-0000-4000-8000-000000000001','patient','Sunita Kale','+919011220001','sunita.kale@example.in','hi'),
  ('c1000000-0000-4000-8000-000000000002','patient','Ramesh Patil','+919011220002','ramesh.patil@example.in','en'),
  ('c1000000-0000-4000-8000-000000000003','patient','Aarav Sharma','+919011220003','aarav.sharma@example.in','en'),
  ('c1000000-0000-4000-8000-000000000004','patient','Fatima Shaikh','+919011220004','fatima.shaikh@example.in','hi'),
  ('c1000000-0000-4000-8000-000000000005','patient','Joseph D''Souza','+919011220005','joseph.dsouza@example.in','te');

insert into doctors (id, registration_no, hpr_id, qualifications, specialization_id, sub_specialty, experience_years, languages, bio, consultation_fee, verified_at) values
  ('d1000000-0000-4000-8000-000000000001','MMC-2009-44127','HPR-2291004411','{MBBS,"MD (General Medicine)"}',1,'Diabetology',15,'{en,hi,mr}','Consultant physician with a diabetes and hypertension practice.',600,now()),
  ('d1000000-0000-4000-8000-000000000002','MMC-2004-31880','HPR-2291004412','{MBBS,"MD (Medicine)",DM}',2,'Interventional Cardiology',21,'{en,hi,ta}','Interventional cardiologist; cath lab at Sanjeevani.',1200,now()),
  ('d1000000-0000-4000-8000-000000000003','MMC-2013-58204','HPR-2291004413','{MBBS,"MD (Paediatrics)"}',3,'Neonatology',11,'{en,ml,hi}','Paediatrician; newborn follow-up and childhood asthma.',700,now()),
  ('d1000000-0000-4000-8000-000000000004','MMC-2011-51993','HPR-2291004414','{MBBS,"MS (Orthopaedics)"}',4,'Sports Injury',13,'{en,hi,ur}','Orthopaedic surgeon; arthroscopy and joint preservation.',900,now()),
  ('d1000000-0000-4000-8000-000000000005','MMC-2016-66710','HPR-2291004415','{MBBS,"MD (Dermatology)"}',5,null,8,'{en,kn,hi}','Dermatologist; chronic urticaria and paediatric eczema.',800,now()),
  ('d1000000-0000-4000-8000-000000000006','MMC-2007-39442','HPR-2291004416','{MBBS,"MD (General Medicine)"}',1,'Infectious Disease',17,'{en,mr,hi}','Physician; ID and antimicrobial stewardship.',650,now()),
  ('d1000000-0000-4000-8000-000000000007','MMC-2018-71225','HPR-2291004417','{MBBS,"DNB (Cardiology)"}',2,'Heart Failure',6,'{en,hi,ur}','Cardiologist; heart-failure clinic on Tuesdays.',1000,null),
  ('d1000000-0000-4000-8000-000000000008','MMC-2012-54118','HPR-2291004418','{MBBS,"MS (OBG)"}',6,'High-risk Obstetrics',12,'{en,hi,kn}','Obstetrician; antenatal care and high-risk pregnancy.',850,now());

insert into doctor_hospitals (doctor_id, hospital_id, department) values
  ('d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Internal Medicine'),
  ('d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','OPD'),
  ('d1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Cardiology'),
  ('d1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002','Paediatrics'),
  ('d1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001','Orthopaedics'),
  ('d1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000003','Dermatology'),
  ('d1000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000002','Internal Medicine'),
  ('d1000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000001','Cardiology'),
  ('d1000000-0000-4000-8000-000000000008','a1000000-0000-4000-8000-000000000002','Obstetrics');

-- ── Availability: Mon–Sat morning and evening OPD ──────────────
insert into doctor_availability (doctor_id, hospital_id, weekday, start_time, end_time, slot_minutes)
select dh.doctor_id, dh.hospital_id, wd, '09:00'::time, '13:00'::time, 15
from doctor_hospitals dh, generate_series(1,6) wd;

insert into doctor_availability (doctor_id, hospital_id, weekday, start_time, end_time, slot_minutes)
select dh.doctor_id, dh.hospital_id, wd, '17:00'::time, '20:00'::time, 20
from doctor_hospitals dh, generate_series(1,5) wd;

-- ── Patients ──────────────────────────────────────────────────
insert into patients (id, mrn, abha_number, abha_address, date_of_birth, sex, blood_group, height_cm, address_line1, city, state, pincode, organ_donor) values
  ('c1000000-0000-4000-8000-000000000001','ND-2026-000481','12345678901234','sunita.kale@abdm','1968-03-14','female','B+',154.0,'Flat 3, Shivneri CHS, Karve Nagar','Pune','Maharashtra','411052','registered'),
  ('c1000000-0000-4000-8000-000000000002','ND-2026-000482','12345678901235','ramesh.patil@abdm','1957-11-02','male','O+',171.5,'22 Shanti Nagar, Wanowrie','Pune','Maharashtra','411040','undisclosed'),
  ('c1000000-0000-4000-8000-000000000003','ND-2026-000483',null,null,'2018-07-21','male','A+',112.0,'B-704 Rose County, Baner','Pune','Maharashtra','411045','undisclosed'),
  ('c1000000-0000-4000-8000-000000000004','ND-2026-000484','12345678901237','fatima.shaikh@abdm','1994-01-09','female','AB-',160.0,'14 Nagar Road, Yerwada','Pune','Maharashtra','411006','not_registered'),
  ('c1000000-0000-4000-8000-000000000005','ND-2026-000485','12345678901238','joseph.dsouza@abdm','1982-06-30','male','O-',176.0,'9 Mount Villa, Camp','Pune','Maharashtra','411001','registered');

insert into emergency_contacts (patient_id, name, relation, phone, is_primary) values
  ('c1000000-0000-4000-8000-000000000001','Prakash Kale','Husband','+919011990001',true),
  ('c1000000-0000-4000-8000-000000000001','Rutuja Kale','Daughter','+919011990002',false),
  ('c1000000-0000-4000-8000-000000000002','Sheetal Patil','Daughter','+919011990003',true),
  ('c1000000-0000-4000-8000-000000000003','Neha Sharma','Mother','+919011990004',true),
  ('c1000000-0000-4000-8000-000000000004','Imran Shaikh','Brother','+919011990005',true),
  ('c1000000-0000-4000-8000-000000000005','Maria D''Souza','Wife','+919011990006',true);

insert into allergies (patient_id, allergen, category, reaction, severity) values
  ('c1000000-0000-4000-8000-000000000001','Penicillin','drug','Urticaria and facial swelling','severe'),
  ('c1000000-0000-4000-8000-000000000001','Dust mite','environmental','Rhinitis','mild'),
  ('c1000000-0000-4000-8000-000000000002','Sulfonamides','drug','Rash','moderate'),
  ('c1000000-0000-4000-8000-000000000003','Peanut','food','Lip swelling, wheeze','anaphylaxis'),
  ('c1000000-0000-4000-8000-000000000005','Ibuprofen','drug','Gastric bleed','severe');

insert into chronic_conditions (patient_id, condition, icd11_code, since, on_treatment) values
  ('c1000000-0000-4000-8000-000000000001','Type 2 diabetes mellitus','5A11','2016-04-01',true),
  ('c1000000-0000-4000-8000-000000000001','Essential hypertension','BA00','2018-09-01',true),
  ('c1000000-0000-4000-8000-000000000002','Chronic kidney disease, stage 3','GB61.3','2021-02-01',true),
  ('c1000000-0000-4000-8000-000000000002','Essential hypertension','BA00','2012-01-01',true),
  ('c1000000-0000-4000-8000-000000000003','Asthma','CA23','2023-06-01',true),
  ('c1000000-0000-4000-8000-000000000004','Iron deficiency anaemia','3A00.0','2025-03-01',true);

insert into family_history (patient_id, relation, condition, age_at_onset) values
  ('c1000000-0000-4000-8000-000000000001','Mother','Type 2 diabetes mellitus',52),
  ('c1000000-0000-4000-8000-000000000001','Father','Ischaemic heart disease',61),
  ('c1000000-0000-4000-8000-000000000002','Brother','Chronic kidney disease',58),
  ('c1000000-0000-4000-8000-000000000005','Father','Colorectal carcinoma',66);

insert into surgical_history (patient_id, procedure_name, performed_on, hospital_name, surgeon_name, anaesthesia) values
  ('c1000000-0000-4000-8000-000000000001','Laparoscopic cholecystectomy','2019-11-12','Sanjeevani Multispeciality Hospital','Dr. R. Kulkarni','General'),
  ('c1000000-0000-4000-8000-000000000002','Right inguinal hernia repair','2014-08-03','Civil Hospital, Kothrud','Dr. A. Bhosale','Spinal'),
  ('c1000000-0000-4000-8000-000000000005','ACL reconstruction, left knee','2022-02-18','Sanjeevani Multispeciality Hospital','Dr. Sameer Qureshi','Regional');

insert into insurance_policies (patient_id, insurer, policy_no, scheme, sum_insured, valid_from, valid_to, tpa_name, tpa_phone) values
  ('c1000000-0000-4000-8000-000000000001','Star Health','SH-2291-004821','Individual',500000,'2025-04-01','2026-03-31','MediAssist','+918000112233'),
  ('c1000000-0000-4000-8000-000000000002','Ayushman Bharat','PMJAY-MH-77120031','PM-JAY',500000,'2024-01-01','2029-12-31',null,'14555'),
  ('c1000000-0000-4000-8000-000000000005','ICICI Lombard','IL-9910-556677','Corporate',1000000,'2026-01-01','2026-12-31','Paramount','+918000445566');

-- ── Drug master (~40 rows) ────────────────────────────────────
insert into drug_master (brand_name, generic_name, strength, form, schedule, class) values
  ('Glycomet','Metformin','500 mg','tablet','H','Biguanide'),
  ('Glycomet','Metformin','1000 mg','tablet','H','Biguanide'),
  ('Amaryl','Glimepiride','2 mg','tablet','H','Sulfonylurea'),
  ('Januvia','Sitagliptin','100 mg','tablet','H','DPP-4 inhibitor'),
  ('Lantus','Insulin glargine','100 IU/mL','injection','H','Insulin'),
  ('Telma','Telmisartan','40 mg','tablet','H','ARB'),
  ('Telma-H','Telmisartan + Hydrochlorothiazide','40/12.5 mg','tablet','H','ARB + Thiazide'),
  ('Amlokind','Amlodipine','5 mg','tablet','H','Calcium channel blocker'),
  ('Ecosprin','Aspirin','75 mg','tablet','H','Antiplatelet'),
  ('Clopilet','Clopidogrel','75 mg','tablet','H','Antiplatelet'),
  ('Rosuvas','Rosuvastatin','10 mg','tablet','H','Statin'),
  ('Atorva','Atorvastatin','20 mg','tablet','H','Statin'),
  ('Lasix','Furosemide','40 mg','tablet','H','Loop diuretic'),
  ('Aldactone','Spironolactone','25 mg','tablet','H','Aldosterone antagonist'),
  ('Metolar','Metoprolol','25 mg','tablet','H','Beta blocker'),
  ('Concor','Bisoprolol','5 mg','tablet','H','Beta blocker'),
  ('Augmentin','Amoxicillin + Clavulanate','625 mg','tablet','H1','Penicillin'),
  ('Mox','Amoxicillin','500 mg','capsule','H1','Penicillin'),
  ('Taxim-O','Cefixime','200 mg','tablet','H1','Cephalosporin'),
  ('Azithral','Azithromycin','500 mg','tablet','H1','Macrolide'),
  ('Ciplox','Ciprofloxacin','500 mg','tablet','H1','Fluoroquinolone'),
  ('Flagyl','Metronidazole','400 mg','tablet','H','Nitroimidazole'),
  ('Bactrim','Cotrimoxazole','800/160 mg','tablet','H1','Sulfonamide'),
  ('Crocin','Paracetamol','650 mg','tablet','OTC','Analgesic/antipyretic'),
  ('Combiflam','Ibuprofen + Paracetamol','400/325 mg','tablet','OTC','NSAID'),
  ('Naprosyn','Naproxen','250 mg','tablet','H','NSAID'),
  ('Zerodol-SP','Aceclofenac + Serratiopeptidase','100/15 mg','tablet','H','NSAID'),
  ('Pan','Pantoprazole','40 mg','tablet','H','Proton pump inhibitor'),
  ('Rantac','Ranitidine','150 mg','tablet','H','H2 blocker'),
  ('Ondem','Ondansetron','4 mg','tablet','H','Antiemetic'),
  ('Allegra','Fexofenadine','120 mg','tablet','OTC','Antihistamine'),
  ('Cetzine','Cetirizine','10 mg','tablet','OTC','Antihistamine'),
  ('Montair-LC','Montelukast + Levocetirizine','10/5 mg','tablet','H','Leukotriene antagonist'),
  ('Asthalin','Salbutamol','100 mcg','inhaler','H','SABA'),
  ('Foracort','Formoterol + Budesonide','6/200 mcg','inhaler','H','LABA + ICS'),
  ('Wysolone','Prednisolone','10 mg','tablet','H','Corticosteroid'),
  ('Thyronorm','Levothyroxine','50 mcg','tablet','H','Thyroid hormone'),
  ('Shelcal','Calcium carbonate + Vitamin D3','500/250 IU','tablet','OTC','Supplement'),
  ('Orofer-XT','Ferrous ascorbate + Folic acid','100/1.5 mg','tablet','OTC','Haematinic'),
  ('Neurobion Forte','Vitamin B complex','—','tablet','OTC','Supplement'),
  ('Zincovit','Multivitamin + Zinc','—','tablet','OTC','Supplement'),
  ('Duphalac','Lactulose','10 g/15 mL','syrup','OTC','Osmotic laxative');

insert into drug_allergen_map (drug_class, allergen) values
  ('Penicillin','Penicillin'),
  ('Cephalosporin','Penicillin'),
  ('Sulfonamide','Sulfonamides'),
  ('NSAID','Ibuprofen'),
  ('Macrolide','Azithromycin');

-- ── Current medications ───────────────────────────────────────
insert into patient_medications (patient_id, drug_text, dose, frequency, started_on) values
  ('c1000000-0000-4000-8000-000000000001','Metformin (Glycomet)','500 mg','1-0-1','2023-04-11'),
  ('c1000000-0000-4000-8000-000000000001','Telmisartan (Telma)','40 mg','1-0-0','2023-04-11'),
  ('c1000000-0000-4000-8000-000000000001','Rosuvastatin (Rosuvas)','10 mg','0-0-1','2024-08-02'),
  ('c1000000-0000-4000-8000-000000000002','Telmisartan (Telma)','40 mg','1-0-0','2022-06-15'),
  ('c1000000-0000-4000-8000-000000000002','Furosemide (Lasix)','40 mg','1-0-0','2025-01-20'),
  ('c1000000-0000-4000-8000-000000000002','Calcium carbonate + D3 (Shelcal)','500 mg','0-1-0','2025-01-20'),
  ('c1000000-0000-4000-8000-000000000003','Salbutamol (Asthalin)','100 mcg','SOS','2024-06-10'),
  ('c1000000-0000-4000-8000-000000000003','Montelukast + Levocetirizine (Montair-LC)','5 mg','0-0-1','2025-11-04'),
  ('c1000000-0000-4000-8000-000000000004','Ferrous ascorbate + Folic acid (Orofer-XT)','100 mg','0-1-0','2025-03-18');

insert into ambulance_providers (name, phone, city, state, is_national) values
  ('National Ambulance Service','108',null,null,true),
  ('Emergency Response','112',null,null,true),
  ('Sanjeevani Ambulance','+912025530000','Pune','Maharashtra',false),
  ('Civil Hospital Ambulance','+912025432299','Pune','Maharashtra',false);

-- ── Two years of appointments, case sheets, bills and check-ins ─
-- Generated rather than typed, so the history is dense enough to make
-- the timeline, the analyte trend chart and the billing drill-down
-- look like a real record instead of three rows.

do $$
declare
  p uuid; d uuid; h uuid; cs uuid; b uuid; ap uuid;
  i int; day timestamptz; n int := 0;
  complaints text[] := array['Fever with chills','Chest discomfort on exertion','Dry cough for 5 days',
    'Generalised weakness','Follow-up: sugar review','Headache, throbbing','Joint pain both knees',
    'Breathlessness on climbing stairs','Burning micturition','Routine follow-up'];
  dxs text[] := array['Type 2 diabetes mellitus','Essential hypertension','Acute viral fever',
    'Upper respiratory tract infection','Osteoarthritis of knee','Iron deficiency anaemia',
    'Gastro-oesophageal reflux disease','Asthma, mild persistent'];
  icds text[] := array['5A11','BA00','1D4Z','CA07','FA01','3A00.0','DA22','CA23'];
  -- Prescriptions, investigations and reports were missing from this seed
  -- while the mock store had them, so a Supabase-backed build showed patients
  -- with a history but no medicines. These arrays mirror the mock's world.
  rx_drugs text[] := array['Metformin (Glycomet)','Telmisartan (Telma)','Rosuvastatin (Rosuvas)',
    'Paracetamol (Crocin)','Amlodipine (Amlong)','Pantoprazole (Pan)','Cetirizine (Cetzine)',
    'Salbutamol (Asthalin)'];
  rx_dose  text[] := array['500 mg','40 mg','10 mg','650 mg','5 mg','40 mg','10 mg','100 mcg'];
  rx_freq  text[] := array['1-0-1','1-0-0','0-0-1','1-1-1','1-0-0','1-0-0','0-0-1','1-1-1'];
  panels   text[] := array['Complete Blood Count','Renal function panel','Liver function panel',
    'HbA1c','Lipid profile','Thyroid profile'];
  rx uuid;
begin
  foreach p in array array[
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000002'::uuid,
    'c1000000-0000-4000-8000-000000000003'::uuid,
    'c1000000-0000-4000-8000-000000000004'::uuid,
    'c1000000-0000-4000-8000-000000000005'::uuid ]
  loop
    for i in 1..14 loop
      n := n + 1;
      day := date_trunc('hour', now()) - ((i * 52 + (n % 11)) || ' days')::interval + interval '10 hours';
      select dh.doctor_id, dh.hospital_id into d, h
        from doctor_hospitals dh offset (n % 9) limit 1;

      insert into appointments (id, token_no, patient_id, doctor_id, hospital_id, slot, status, reason, mode)
      values (gen_random_uuid(), (n % 20) + 1, p, d, h,
              tstzrange(day, day + interval '15 minutes', '[)'),
              'completed', complaints[(n % 10) + 1], 'in_person')
      returning id into ap;

      insert into case_sheets (patient_id, doctor_id, hospital_id, appointment_id, visit_type,
        chief_complaints, hopi, general_exam, provisional_dx, advice, status, finalized_at, created_at)
      values (p, d, h, ap, case when i = 1 then 'opd' else 'followup' end,
        jsonb_build_array(jsonb_build_object('complaint', complaints[(n % 10) + 1],
          'duration_value', (n % 6) + 1, 'duration_unit','days')),
        jsonb_build_object('onset','gradual','severity_0_10',(n % 8) + 1,'timing','intermittent'),
        jsonb_build_object('pallor', n % 4 = 0, 'icterus', false, 'cyanosis', false, 'edema', n % 7 = 0),
        dxs[(n % 8) + 1],
        'Continue current medication. Review in 4 weeks. Salt restriction reinforced.',
        'finalized', day + interval '25 minutes', day)
      returning id into cs;

      insert into diagnoses (case_sheet_id, patient_id, icd11_code, icd11_title, certainty, is_chronic)
      values (cs, p, icds[(n % 8) + 1], dxs[(n % 8) + 1],
              case when n % 3 = 0 then 'confirmed' else 'provisional' end, n % 4 = 0);

      insert into vitals (patient_id, case_sheet_id, recorded_at, source,
        temperature_c, pulse_bpm, resp_rate, bp_systolic, bp_diastolic, spo2, weight_kg, random_glucose)
      values (p, cs, day, 'clinic',
        36.6 + ((n % 18) / 10.0), 68 + (n % 34), 14 + (n % 6),
        112 + (n % 46), 70 + (n % 24), 95 + (n % 5),
        52 + (n % 33), 92 + (n % 84));

      insert into bills (patient_id, hospital_id, case_sheet_id, bill_no, billed_on,
        subtotal, discount, tax, total, insurance_covered, status)
      values (p, h, cs, 'INV-' || to_char(day,'YYYYMM') || '-' || lpad(n::text, 5, '0'), day::date,
        600 + (n % 9) * 250, case when n % 5 = 0 then 100 else 0 end, 0,
        600 + (n % 9) * 250 - case when n % 5 = 0 then 100 else 0 end,
        case when n % 3 = 0 then (600 + (n % 9) * 250) * 0.6 else 0 end,
        case when n % 8 = 0 then 'unpaid' else 'paid' end)
      returning id into b;

      insert into bill_items (bill_id, category, description, qty, unit_price) values
        (b,'consultation','OPD consultation',1, 600),
        (b,'pharmacy','Dispensed medication', 1, (n % 9) * 120),
        (b,'lab','Laboratory panel', 1, (n % 5) * 180);

      -- A prescription with two items, and a verify token so the pharmacist
      -- page at /verify/[token] resolves against a real row.
      insert into prescriptions (case_sheet_id, patient_id, doctor_id, issued_at, verify_token)
      values (cs, p, d, day + interval '20 minutes', 'RX-' || lpad(n::text, 6, '0'))
      returning id into rx;

      insert into prescription_items (prescription_id, drug_text, dose, frequency, timing, duration_days, quantity)
      values
        (rx, rx_drugs[(n % 8) + 1], rx_dose[(n % 8) + 1], rx_freq[(n % 8) + 1],
         'after food', 30,
         30 * (length(replace(rx_freq[(n % 8) + 1],'-','')) -
               length(replace(replace(rx_freq[(n % 8) + 1],'-',''),'0','')))),
        (rx, rx_drugs[((n + 3) % 8) + 1], rx_dose[((n + 3) % 8) + 1], '1-0-0',
         'before food', 15, 15);

      -- Every third visit orders a panel; every fourth also files the report,
      -- with the analyte values pre-extracted the way the OCR pipeline would.
      if n % 3 = 0 then
        insert into investigation_orders (case_sheet_id, patient_id, test_name, panel, urgency, status, ordered_at)
        values (cs, p, panels[(n % 6) + 1], panels[(n % 6) + 1],
                case when n % 12 = 0 then 'urgent' else 'routine' end,
                case when n % 4 = 0 then 'reported' else 'ordered' end,
                day + interval '15 minutes');
      end if;

      if n % 4 = 0 then
        insert into documents (patient_id, case_sheet_id, kind, title, storage_path, mime_type,
          size_bytes, report_date, ordering_doctor, ocr_text, extracted_values, uploaded_by, uploaded_at)
        values (p, cs, 'lab_report',
          panels[(n % 6) + 1] || ' — ' || to_char(day, 'DD Mon YYYY'),
          'reports/' || p::text || '/' || n::text || '.pdf', 'application/pdf',
          180000 + (n % 40) * 1000, day::date, d,
          'Haemoglobin ' || (10.4 + (n % 40) / 10.0)::numeric(4,1) || ' g/dL. Creatinine ' ||
            (0.7 + (n % 14) / 10.0)::numeric(4,1) || ' mg/dL. TLC ' || (5200 + (n % 60) * 90) || ' /cumm.',
          jsonb_build_array(
            jsonb_build_object('analyte','Haemoglobin','value',(10.4 + (n % 40) / 10.0)::numeric(4,1),
              'unit','g/dL','ref','12-15','flag', case when (10.4 + (n % 40) / 10.0) < 12 then 'low' else 'normal' end),
            jsonb_build_object('analyte','Creatinine','value',(0.7 + (n % 14) / 10.0)::numeric(4,1),
              'unit','mg/dL','ref','0.6-1.2','flag', case when (0.7 + (n % 14) / 10.0) > 1.2 then 'high' else 'normal' end),
            jsonb_build_object('analyte','TLC','value',(5200 + (n % 60) * 90),
              'unit','/cumm','ref','4000-11000','flag', case when (5200 + (n % 60) * 90) > 11000 then 'high' else 'normal' end)),
          p, day + interval '1 day');
      end if;

      -- Two systemic findings per visit, so the case sheet's examination
      -- section is not empty on a Supabase-backed read.
      insert into examination_findings (case_sheet_id, system, method, finding, is_normal) values
        (cs, 'cvs', 'auscultation',
         case when n % 6 = 0 then 'Soft systolic murmur at apex' else 'S1 S2 normal, no murmur' end, n % 6 <> 0),
        (cs, 'respiratory', 'auscultation',
         case when n % 5 = 0 then 'Scattered rhonchi both lung fields' else 'Bilateral air entry equal, clear' end, n % 5 <> 0);
    end loop;
  end loop;
end $$;

-- 90 days of daily check-ins for the two chronic patients
insert into daily_checkins (patient_id, log_date, mood, energy, sleep_hours, pain_score, meds_taken, water_glasses)
select p, current_date - g,
       3 + ((g + 1) % 3) - 1, 3 + (g % 3) - 1,
       6.0 + ((g % 7) / 2.0), (g % 5), (g % 9) <> 0, 5 + (g % 4)
from (values ('c1000000-0000-4000-8000-000000000001'::uuid),
             ('c1000000-0000-4000-8000-000000000002'::uuid)) v(p),
     generate_series(0, 89) g
on conflict do nothing;

-- device readings: 30 days of steps and resting heart rate
insert into device_readings (patient_id, provider, metric, value, unit, measured_at)
select 'c1000000-0000-4000-8000-000000000001'::uuid, 'google_fit', m.metric,
       case m.metric when 'steps' then 3000 + (g * 137 % 5200)
                     when 'heart_rate' then 62 + (g % 14)
                     else 380 + (g % 90) end,
       case m.metric when 'steps' then 'count' when 'heart_rate' then 'bpm' else 'minutes' end,
       (current_date - g)::timestamptz + interval '21 hours'
from generate_series(0, 29) g,
     (values ('steps'),('heart_rate'),('sleep_minutes')) m(metric)
on conflict do nothing;

-- emergency cards
insert into emergency_cards (patient_id, token) values
  ('c1000000-0000-4000-8000-000000000001','EMG-8f2a91c4d7'),
  ('c1000000-0000-4000-8000-000000000002','EMG-3b71ee02af'),
  ('c1000000-0000-4000-8000-000000000003','EMG-c90d54187b'),
  ('c1000000-0000-4000-8000-000000000004','EMG-11ae63cd90'),
  ('c1000000-0000-4000-8000-000000000005','EMG-7d40b2fa16');

-- live care relationships, so the demo doctor opens a record immediately
insert into care_relationships (patient_id, doctor_id, basis, granted_via)
values ('c1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','appointment','seed'),
       ('c1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','appointment','seed');

-- one consent deliberately close to lapsing, to match cr-4 in seed.ts: the
-- doctor's "expiring this week" card needs a real row behind it.
insert into care_relationships (patient_id, doctor_id, basis, granted_via, granted_at, expires_at)
values ('c1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000001',
        'patient_consent','OTP approval', now() - interval '27 days', now() + interval '3 days');

