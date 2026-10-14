import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser, homeFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { next } = await searchParams;
  return (
    <>
      <h1 className="font-display text-[2.5rem] leading-none">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to book tickets and manage your events.</p>
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
