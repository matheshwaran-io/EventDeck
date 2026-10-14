DO $$ BEGIN
  CREATE TYPE "public"."institution_type" AS ENUM('SRM', 'EXTERNAL_INSTITUTION', 'GUEST');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."campus" AS ENUM('KTR', 'RAMAPURAM', 'VADAPALANI', 'OTHER_SRM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."affiliation" AS ENUM('STUDENT', 'FACULTY', 'STAFF', 'ALUMNI', 'GUEST');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "institution_type" "public"."institution_type" DEFAULT 'SRM' NOT NULL;
--> statement-breakpoint
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "campus" "public"."campus";
--> statement-breakpoint
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "affiliation" "public"."affiliation" DEFAULT 'STUDENT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "institution_name" text;
--> statement-breakpoint
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "city" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_institution_type_idx" ON "public"."profiles" ("institution_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_campus_idx" ON "public"."profiles" ("campus");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_affiliation_idx" ON "public"."profiles" ("affiliation");
--> statement-breakpoint
UPDATE "public"."profiles"
SET 
  "institution_type" = CASE
    WHEN "category" = 'guest' THEN 'GUEST'::"public"."institution_type"
    WHEN "category" = 'external_student' THEN 'EXTERNAL_INSTITUTION'::"public"."institution_type"
    WHEN "institution" ILIKE '%VIT%' OR "institution" ILIKE '%college%' OR "institution" ILIKE '%university%' AND "institution" NOT ILIKE '%SRM%' THEN 'EXTERNAL_INSTITUTION'::"public"."institution_type"
    ELSE 'SRM'::"public"."institution_type"
  END,
  "campus" = CASE
    WHEN "category" = 'guest' OR "category" = 'external_student' THEN NULL
    WHEN "institution" ILIKE '%Ramapuram%' THEN 'RAMAPURAM'::"public"."campus"
    WHEN "institution" ILIKE '%Vadapalani%' THEN 'VADAPALANI'::"public"."campus"
    WHEN "institution" ILIKE '%SRM%' AND ("institution" NOT ILIKE '%KTR%' AND "institution" NOT ILIKE '%Kattankulathur%') THEN 'OTHER_SRM'::"public"."campus"
    ELSE 'KTR'::"public"."campus"
  END,
  "affiliation" = CASE
    WHEN "category" = 'guest' THEN 'GUEST'::"public"."affiliation"
    WHEN "category" = 'faculty' THEN 'FACULTY'::"public"."affiliation"
    WHEN "category" = 'staff' THEN 'STAFF'::"public"."affiliation"
    WHEN "category" = 'alumni' THEN 'ALUMNI'::"public"."affiliation"
    ELSE 'STUDENT'::"public"."affiliation"
  END,
  "institution_name" = CASE
    WHEN "category" = 'guest' THEN NULL
    WHEN "category" = 'external_student' THEN coalesce("institution", 'External Institution')
    ELSE coalesce("institution", 'SRM University')
  END
WHERE "institution_type" = 'SRM' AND "campus" IS NULL AND "category" IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  cat public.participant_category := 'host_student';
  inst_type public.institution_type := 'SRM';
  camp public.campus := 'KTR';
  affil public.affiliation := 'STUDENT';
  inst_name text := NULL;
  c_city text := NULL;
  full_nm text := left(coalesce(nullif(trim(meta->>'full_name'), ''), split_part(new.email, '@', 1)), 120);
BEGIN
  -- Read institution_type
  IF meta ? 'institution_type' AND meta->>'institution_type' IN ('SRM', 'EXTERNAL_INSTITUTION', 'GUEST') THEN
    inst_type := (meta->>'institution_type')::public.institution_type;
  ELSIF meta ? 'category' AND meta->>'category' = 'guest' THEN
    inst_type := 'GUEST';
  ELSIF meta ? 'category' AND meta->>'category' = 'external_student' THEN
    inst_type := 'EXTERNAL_INSTITUTION';
  END IF;

  -- Read campus (only applicable for SRM)
  IF inst_type = 'SRM' THEN
    IF meta ? 'campus' AND meta->>'campus' IN ('KTR', 'RAMAPURAM', 'VADAPALANI', 'OTHER_SRM') THEN
      camp := (meta->>'campus')::public.campus;
    ELSE
      camp := 'KTR';
    END IF;
  ELSE
    camp := NULL;
  END IF;

  -- Read affiliation
  IF inst_type = 'GUEST' THEN
    affil := 'GUEST';
  ELSIF meta ? 'affiliation' AND meta->>'affiliation' IN ('STUDENT', 'FACULTY', 'STAFF', 'ALUMNI', 'GUEST') THEN
    affil := (meta->>'affiliation')::public.affiliation;
  ELSIF meta ? 'category' THEN
    IF meta->>'category' = 'faculty' THEN affil := 'FACULTY';
    ELSIF meta->>'category' = 'staff' THEN affil := 'STAFF';
    ELSIF meta->>'category' = 'alumni' THEN affil := 'ALUMNI';
    ELSIF meta->>'category' = 'guest' THEN affil := 'GUEST';
    ELSE affil := 'STUDENT';
    END IF;
  END IF;

  -- Read institution_name and city
  IF inst_type = 'SRM' THEN
    inst_name := 'SRM University';
  ELSIF inst_type = 'EXTERNAL_INSTITUTION' THEN
    inst_name := nullif(left(trim(coalesce(meta->>'institution_name', meta->>'institution', '')), 160), '');
    c_city := nullif(left(trim(coalesce(meta->>'city', '')), 100), '');
  ELSE
    inst_name := NULL;
    c_city := NULL;
  END IF;

  -- Map to legacy participant_category for event eligibility compatibility
  IF inst_type = 'GUEST' OR affil = 'GUEST' THEN
    cat := 'guest';
  ELSIF affil = 'FACULTY' THEN
    cat := 'faculty';
  ELSIF affil = 'STAFF' THEN
    cat := 'staff';
  ELSIF affil = 'ALUMNI' THEN
    cat := 'alumni';
  ELSIF inst_type = 'SRM' THEN
    cat := 'host_student';
  ELSE
    cat := 'external_student';
  END IF;

  -- Insert profile. Role is ALWAYS 'participant'. Client can never self-promote.
  INSERT INTO public.profiles (
    id, email, full_name, category, institution, institution_type, campus, affiliation, institution_name, city, role
  )
  VALUES (
    new.id,
    new.email,
    full_nm,
    cat,
    nullif(left(trim(coalesce(meta->>'institution', inst_name, '')), 160), ''),
    inst_type,
    camp,
    affil,
    inst_name,
    c_city,
    'participant'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    category = EXCLUDED.category,
    institution = coalesce(EXCLUDED.institution, public.profiles.institution),
    institution_type = EXCLUDED.institution_type,
    campus = EXCLUDED.campus,
    affiliation = EXCLUDED.affiliation,
    institution_name = EXCLUDED.institution_name,
    city = EXCLUDED.city;

  RETURN new;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
