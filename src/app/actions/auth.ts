"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSrmEmail } from "@/lib/constants";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SignupInput,
} from "@/lib/validation/auth";
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

  const isSrm = isSrmEmail(parsed.data.email);

  // Normalize institution type, campus, and affiliation
  let instType = parsed.data.institutionType;
  let camp = parsed.data.campus ?? null;
  let affil = parsed.data.affiliation;
  let instName = parsed.data.institutionName?.trim() || "";
  let city = parsed.data.city?.trim() || "";
  const department = parsed.data.department?.trim() || "";

  // Infer from legacy category if needed
  if (!instType && parsed.data.category) {
    if (parsed.data.category === "host_student") {
      instType = "SRM";
      camp = camp ?? "KTR";
      affil = "STUDENT";
    } else if (parsed.data.category === "external_student") {
      instType = "EXTERNAL_INSTITUTION";
      affil = "STUDENT";
      instName = instName || parsed.data.institution?.trim() || "";
    } else if (parsed.data.category === "faculty") {
      instType = isSrm ? "SRM" : "EXTERNAL_INSTITUTION";
      camp = isSrm ? (camp ?? "KTR") : null;
      affil = "FACULTY";
      instName = instName || parsed.data.institution?.trim() || "";
    } else if (parsed.data.category === "staff") {
      instType = "SRM";
      camp = camp ?? "KTR";
      affil = "STAFF";
    } else if (parsed.data.category === "alumni") {
      instType = "SRM";
      camp = camp ?? "KTR";
      affil = "ALUMNI";
    } else if (parsed.data.category === "guest") {
      instType = "GUEST";
      affil = "GUEST";
    }
  }

  instType = instType ?? "SRM";
  affil = affil ?? "STUDENT";
  if (instType === "SRM") {
    camp = camp ?? "KTR";
    instName = "SRM University";
  } else if (instType === "GUEST") {
    camp = null;
    affil = "GUEST";
    instName = "";
    city = "";
  } else {
    camp = null;
  }

  // Determine legacy category for event eligibility compatibility
  let legacyCategory: "host_student" | "external_student" | "faculty" | "staff" | "alumni" | "guest" = "host_student";
  let formattedInstitution = "";

  if (instType === "GUEST" || affil === "GUEST") {
    legacyCategory = "guest";
    formattedInstitution = "Guest";
  } else if (instType === "SRM") {
    if (affil === "STUDENT") legacyCategory = "host_student";
    else if (affil === "FACULTY") legacyCategory = "faculty";
    else if (affil === "STAFF") legacyCategory = "staff";
    else if (affil === "ALUMNI") legacyCategory = "alumni";

    formattedInstitution = department ? `SRM ${camp} — ${department}` : `SRM ${camp} Campus`;
  } else {
    if (affil === "FACULTY") legacyCategory = "faculty";
    else if (affil === "STAFF") legacyCategory = "staff";
    else legacyCategory = "external_student";

    formattedInstitution = `${instName}${city ? ` (${city})` : ""}`;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Descriptive metadata only. The database trigger always assigns the participant role.
      data: {
        full_name: parsed.data.fullName,
        institution_type: instType,
        campus: camp,
        affiliation: affil,
        institution_name: instName || null,
        city: city || null,
        department: department || null,
        category: legacyCategory,
        institution: formattedInstitution,
      },
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

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ActionResult<{ success: boolean }>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const supabase = await createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/confirm?next=/reset-password`,
  });
  if (error) {
    if (/rate|too many/i.test(error.message)) {
      return { ok: false, error: "Too many attempts. Please wait a moment and try again." };
    }
  }
  // Always return success for security to prevent email enumeration
  return { ok: true, data: { success: true } };
}

export async function resetPassword(input: ResetPasswordInput): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid password." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error || !data.user) {
    if (/same_password/i.test(error?.message ?? "")) {
      return { ok: false, error: "New password must be different from your old password." };
    }
    return { ok: false, error: error?.message ?? "Could not update password. Your reset link may have expired." };
  }
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  return { ok: true, data: { redirectTo: profile ? homeFor(profile.role) : "/events" } };
}
