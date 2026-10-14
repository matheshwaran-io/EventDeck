"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { resetPassword } from "@/app/actions/auth";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { register, handleSubmit, formState } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const res = await resetPassword(values);
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
      <Field
        label="New password"
        htmlFor="password"
        error={formState.errors.password?.message}
        hint="At least 8 characters with a letter and a number."
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(formState.errors.password)}
          {...register("password")}
        />
      </Field>
      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        error={formState.errors.confirmPassword?.message}
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(formState.errors.confirmPassword)}
          {...register("confirmPassword")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Update password
      </Button>
    </form>
  );
}
