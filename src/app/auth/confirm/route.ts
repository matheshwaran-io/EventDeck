import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Email confirmation landing (used when "Confirm email" is enabled in Supabase Auth). */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const fallback = type === "recovery" ? "/reset-password" : "/events";
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : fallback;

  const supabase = await createSupabaseServerClient();
  let ok = false;
  if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  return NextResponse.redirect(new URL(ok ? next : `/login?error=${type === "recovery" ? "recovery" : "confirmation"}`, url.origin));
}
