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
