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
