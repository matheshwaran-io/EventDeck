"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/server/errors";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

function safeNext(next: string | undefined | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function signIn(input: LoginInput, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email and password." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    const msg = error?.message ?? "";
    if (/banned/i.test(msg)) return { ok: false, error: "This account has been deactivated. Contact an administrator." };
    if (/confirm/i.test(msg)) return { ok: false, error: "Please confirm your email address first." };
    if (/rate|too many/i.test(msg)) return { ok: false, error: "Too many attempts. Please wait a moment and try again." };
    return { ok: false, error: "Incorrect email or password." };
  }
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  if (!profile?.isActive) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account has been deactivated. Contact an administrator." };
  }
  return { ok: true, data: { redirectTo: safeNext(next) ?? homeFor(profile.role) } };
}

export async function signUp(input: SignupInput): Promise<ActionResult<{ redirectTo?: string; needsConfirmation?: boolean }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Only descriptive metadata. The database trigger always assigns the participant role.
      data: { full_name: parsed.data.fullName, category: parsed.data.category, institution: parsed.data.institution },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/confirm`,
    },
  });
  if (error) {
    if (/registered|exists/i.test(error.message)) return { ok: false, error: "An account with this email already exists. Try signing in." };
    if (/rate|too many/i.test(error.message)) return { ok: false, error: "Too many attempts. Please wait a moment and try again." };
    if (/password/i.test(error.message)) return { ok: false, error: error.message };
    return { ok: false, error: "We couldn't create your account. Please try again." };
  }
  if (!data.session) return { ok: true, data: { needsConfirmation: true } };
  return { ok: true, data: { redirectTo: "/events" } };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function whoAmI() {
  const user = await getCurrentUser();
  return user ? { id: user.id, role: user.role } : null;
}
