-- Ensure eventdeck88@gmail.com is admin and active
UPDATE public.profiles
SET role = 'admin', is_active = true, updated_at = now()
WHERE lower(email) = 'eventdeck88@gmail.com';
--> statement-breakpoint

-- Trigger to protect root admin from deletion, demotion, deactivation, or email alteration in profiles
CREATE OR REPLACE FUNCTION public.protect_root_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF lower(OLD.email) = 'eventdeck88@gmail.com' THEN
      RAISE EXCEPTION 'Root administrator account cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF lower(OLD.email) = 'eventdeck88@gmail.com' THEN
      IF NEW.role != 'admin' THEN
        RAISE EXCEPTION 'Root administrator role cannot be changed.';
      END IF;
      IF NEW.is_active = false THEN
        RAISE EXCEPTION 'Root administrator account cannot be deactivated.';
      END IF;
      IF lower(NEW.email) != lower(OLD.email) THEN
        RAISE EXCEPTION 'Root administrator email cannot be changed.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_root_admin ON public.profiles;
--> statement-breakpoint
CREATE TRIGGER trg_protect_root_admin
BEFORE UPDATE OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_root_admin();
--> statement-breakpoint

-- Trigger to protect root admin from deletion in auth.users
CREATE OR REPLACE FUNCTION public.protect_auth_root_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF lower(OLD.email) = 'eventdeck88@gmail.com' THEN
      RAISE EXCEPTION 'Root administrator account cannot be deleted from auth.';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_auth_root_admin ON auth.users;
--> statement-breakpoint
CREATE TRIGGER trg_protect_auth_root_admin
BEFORE DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_auth_root_admin();
--> statement-breakpoint

-- Update handle_new_user to automatically grant admin role to eventdeck88@gmail.com
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
  user_role public.user_role := CASE WHEN lower(new.email) = 'eventdeck88@gmail.com' THEN 'admin'::public.user_role ELSE 'participant'::public.user_role END;
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

  -- Map to legacy participant_category
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

  INSERT INTO public.profiles (
    id, email, full_name, category, institution, institution_type, campus, affiliation, institution_name, city, role, is_active
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
    user_role,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    category = EXCLUDED.category,
    institution = coalesce(EXCLUDED.institution, public.profiles.institution),
    institution_type = EXCLUDED.institution_type,
    campus = EXCLUDED.campus,
    affiliation = EXCLUDED.affiliation,
    institution_name = EXCLUDED.institution_name,
    city = EXCLUDED.city,
    role = CASE WHEN lower(public.profiles.email) = 'eventdeck88@gmail.com' THEN 'admin'::public.user_role ELSE public.profiles.role END,
    is_active = CASE WHEN lower(public.profiles.email) = 'eventdeck88@gmail.com' THEN true ELSE public.profiles.is_active END;

  RETURN new;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
