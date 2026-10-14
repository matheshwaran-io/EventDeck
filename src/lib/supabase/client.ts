"use client";
import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}

/**
 * Realtime must join channels with the user's JWT, otherwise RLS treats the
 * socket as anonymous and silently filters every row. Load the session first.
 */
export async function getAuthedRealtimeClient() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
  return supabase;
}
