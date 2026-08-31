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
