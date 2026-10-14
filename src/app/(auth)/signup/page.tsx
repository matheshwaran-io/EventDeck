import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentUser, homeFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return (
    <>
      <h1 className="font-display text-[2.5rem] leading-none">Create your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">Students, faculty, staff and guests are all welcome.</p>
      <SignupForm />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground link-underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
