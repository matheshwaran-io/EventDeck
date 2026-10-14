"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { signIn } from "@/app/actions/auth";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const res = await signIn(values, next);
      if (!res.ok) return setError(res.error);
      router.replace(res.data!.redirectTo);
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/20 bg-danger-soft px-3 py-2.5 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={Boolean(formState.errors.email)} {...register("email")} />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={formState.errors.password?.message}
        corner={
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors link-underline"
          >
            Forgot password?
          </Link>
        }
      >
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(formState.errors.password)} {...register("password")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Sign in
      </Button>
    </form>
  );
}
