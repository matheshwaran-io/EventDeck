import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser, homeFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="font-display text-[2.5rem] leading-none">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to book tickets and manage your events.</p>
      {error === "recovery" && (
        <p role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-danger-soft px-3 py-2.5 text-sm font-medium text-destructive">
          Your password reset link was invalid or has expired. Please request a new one.
        </p>
      )}
      {error === "confirmation" && (
        <p role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-danger-soft px-3 py-2.5 text-sm font-medium text-destructive">
          Email confirmation failed or link has expired.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-medium text-foreground link-underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
