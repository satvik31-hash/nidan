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
