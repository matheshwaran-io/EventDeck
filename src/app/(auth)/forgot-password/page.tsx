import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getCurrentUser, homeFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <>
      <h1 className="font-display text-[2.5rem] leading-none">Forgot password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the email associated with your account and we&apos;ll send you a link to reset your password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-foreground link-underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
