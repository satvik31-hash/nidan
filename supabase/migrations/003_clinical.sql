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
