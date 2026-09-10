-- ═══════════════════════════════════════════════════════════════
-- 007 — administration: company-wide, read-only oversight
--
-- The mock store's assertAccess() already lets an admin actor through
-- unconditionally (src/lib/db/store.ts). This migration gives the SQL side
-- the same rule, so the schema stays honest once a real Supabase project
-- is linked: an admin can SELECT everywhere, but INSERT/UPDATE/DELETE stay
-- exactly as governed by 006 — administration never writes to a record.
-- ═══════════════════════════════════════════════════════════════

create or replace function is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'patients', 'doctors', 'hospitals', 'appointments',
    'case_sheets', 'vitals', 'diagnoses', 'prescriptions', 'documents',
    'allergies', 'surgical_history', 'family_history', 'chronic_conditions',
    'patient_medications', 'investigation_orders', 'emergency_contacts',
    'insurance_policies', 'bills', 'daily_checkins', 'device_readings',
    'care_relationships', 'access_audit'
  ] loop
    execute format(
      'create policy "admin reads company-wide" on %I for select using (is_admin())', t);
  end loop;
end $$;
