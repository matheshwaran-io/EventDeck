-- Security layer: profile provisioning, role helpers, Row Level Security,
-- realtime publication, and storage buckets.
--
-- All writes go through the Next.js server (privileged connection). Browser
-- clients holding the anon key / a user JWT may only READ rows they are
-- entitled to; every write privilege is revoked from anon/authenticated.

-- 1. Profile provisioning ---------------------------------------------------
-- Public signups always become participants. The role is never read from
-- user-supplied metadata, so nobody can self-promote at signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  cat public.participant_category := 'host_student';
BEGIN
  IF meta ? 'category' AND meta->>'category' IN ('host_student','external_student','faculty','staff','alumni','guest') THEN
    cat := (meta->>'category')::public.participant_category;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, category, institution, role)
  VALUES (
    new.id,
    new.email,
    left(coalesce(nullif(trim(meta->>'full_name'), ''), split_part(new.email, '@', 1)), 120),
    cat,
    nullif(left(trim(coalesce(meta->>'institution', '')), 160), ''),
    'participant'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint

-- 2. Role helpers (security definer so policies can consult profiles) -------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.owns_event(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.profiles p ON p.id = e.organizer_id
    WHERE e.id = target AND e.organizer_id = auth.uid() AND p.role = 'organizer' AND p.is_active
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.owns_booking(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = target AND b.user_id = auth.uid());
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- 3. Lock down table privileges ---------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
--> statement-breakpoint

-- 4. Row Level Security -------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.organizer_applications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
--> statement-breakpoint
CREATE POLICY organizer_applications_select ON public.organizer_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
--> statement-breakpoint
-- Only public, non-draft events are listable through the API. Unlisted events
-- are served by slug from the server, never enumerable by clients.
CREATE POLICY events_select_public ON public.events FOR SELECT TO anon, authenticated
  USING (visibility = 'public' AND status <> 'draft');
--> statement-breakpoint
CREATE POLICY events_select_owner ON public.events FOR SELECT TO authenticated
  USING (public.owns_event(id) OR public.is_admin());
--> statement-breakpoint
CREATE POLICY ticket_tiers_select ON public.ticket_tiers FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id AND e.visibility = 'public' AND e.status <> 'draft'
  ) OR public.owns_event(event_id) OR public.is_admin());
--> statement-breakpoint
CREATE POLICY bookings_select ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owns_event(event_id) OR public.is_admin());
--> statement-breakpoint
CREATE POLICY booking_items_select ON public.booking_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id AND (b.user_id = auth.uid() OR public.owns_event(b.event_id))
  ) OR public.is_admin());
--> statement-breakpoint
CREATE POLICY tickets_select ON public.tickets FOR SELECT TO authenticated
  USING (public.owns_booking(booking_id) OR public.owns_event(event_id) OR public.is_admin());
--> statement-breakpoint
CREATE POLICY check_ins_select ON public.check_ins FOR SELECT TO authenticated
  USING (public.owns_event(event_id) OR public.is_admin());
--> statement-breakpoint
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
  USING (public.owns_booking(booking_id) OR public.is_admin());
--> statement-breakpoint
CREATE POLICY refunds_select ON public.refunds FOR SELECT TO authenticated
  USING (public.owns_booking(booking_id) OR public.is_admin());
--> statement-breakpoint
CREATE POLICY cancellation_requests_select ON public.cancellation_requests FOR SELECT TO authenticated
  USING (public.owns_event(event_id) OR public.is_admin());
--> statement-breakpoint
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin() OR (event_id IS NOT NULL AND public.owns_event(event_id)));
--> statement-breakpoint
-- webhook_events: no policies => invisible to API clients.

-- 5. Realtime: notification + booking change feeds (RLS-filtered) ------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications, public.bookings;
  END IF;
END
$$;
--> statement-breakpoint

-- 6. Storage buckets ----------------------------------------------------------
-- posters: public read (event artwork), writes only via the server.
-- tickets: private; PDFs are streamed through an authorised route handler.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('posters', 'posters', true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('tickets', 'tickets', false, 5242880, ARRAY['application/pdf'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;
