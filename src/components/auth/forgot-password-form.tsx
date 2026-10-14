"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { requestPasswordReset } from "@/app/actions/auth";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { register, handleSubmit, formState } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const res = await requestPasswordReset(values);
      if (!res.ok) return setError(res.error);
      setSubmittedEmail(values.email);
    }),
  );

  if (submittedEmail) {
    return (
      <div className="mt-8 space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-signal/10 text-signal">
          <Mail className="size-7" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a password reset link to <strong className="text-foreground">{submittedEmail}</strong>.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or try again in a few minutes.
        </p>
        <div className="pt-2">
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => setSubmittedEmail(null)}
          >
            Try another email
          </Button>
        </div>
        <div>
          <Link
            href="/login"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors link-underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/20 bg-danger-soft px-3 py-2.5 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Field label="Email address" htmlFor="email" error={formState.errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@university.edu"
          aria-invalid={Boolean(formState.errors.email)}
          {...register("email")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Send reset link
      </Button>
    </form>
  );
}
