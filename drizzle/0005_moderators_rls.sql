-- Event moderators: readable by the moderator themself, the event's organizer and admins.
-- All writes go through the server (no insert/update/delete grants for API roles).
ALTER TABLE public.event_moderators ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.event_moderators FROM anon, authenticated;
--> statement-breakpoint
CREATE POLICY event_moderators_select ON public.event_moderators FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owns_event(event_id) OR public.is_admin());
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.moderates_event(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_moderators m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.event_id = target AND m.user_id = auth.uid() AND m.revoked_at IS NULL AND p.is_active
  );
$$;
--> statement-breakpoint
-- Moderators may read check-ins for events they moderate (scanner session counts).
DROP POLICY IF EXISTS check_ins_select ON public.check_ins;
--> statement-breakpoint
CREATE POLICY check_ins_select ON public.check_ins FOR SELECT TO authenticated
  USING (public.owns_event(event_id) OR public.moderates_event(event_id) OR public.is_admin());
