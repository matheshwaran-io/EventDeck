import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <>
        <h1 className="font-display text-[2.5rem] leading-none">Link expired</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <div className="mt-8">
          <Link
            href="/forgot-password"
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Request new reset link
          </Link>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="font-medium text-foreground link-underline">
            Sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-[2.5rem] leading-none">Set new password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose a strong password to secure your account.
      </p>
      <ResetPasswordForm />
    </>
  );
}
