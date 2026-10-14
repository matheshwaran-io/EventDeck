-- QA-001 fix: the signup trigger trusted client metadata (and defaulted to
-- "SRM student"), letting any email self-classify as an SRM member through a
-- direct Supabase Auth call. Same rules as the app's signup validation now apply.
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

  -- QA-001: SRM membership for students/staff requires an official SRM email.
  -- Metadata is client-controlled (anyone can call Supabase Auth with the public key),
  -- so an unverifiable claim is downgraded to Guest instead of being trusted.
  IF inst_type = 'SRM' AND affil IN ('STUDENT', 'STAFF')
     AND new.email !~* '@([a-z0-9-]+\.)*(srmist\.edu\.in|srmuniv\.ac\.in)$' THEN
    inst_type := 'GUEST';
    camp := NULL;
    affil := 'GUEST';
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
