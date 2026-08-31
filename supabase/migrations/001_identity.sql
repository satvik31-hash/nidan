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
