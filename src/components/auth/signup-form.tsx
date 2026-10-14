"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { signUp } from "@/app/actions/auth";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { PARTICIPANT_CATEGORIES } from "@/lib/constants";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState, watch } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { category: "host_student", institution: "" },
  });
  const category = watch("category");

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const res = await signUp(values);
      if (!res.ok) return setError(res.error);
      if (res.data?.needsConfirmation) return setSent(true);
      router.replace(res.data?.redirectTo ?? "/events");
      router.refresh();
    }),
  );

  if (sent) {
    return (
      <div className="mt-8 rounded-xl border bg-card p-6 text-center">
        <MailCheck className="mx-auto size-6 text-success" />
        <p className="mt-3 font-medium">Check your inbox</p>
        <p className="mt-1 text-sm text-muted-foreground">We sent a confirmation link. Open it to activate your account.</p>
      </div>
    );
  }

  const e = formState.errors;
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/20 bg-danger-soft px-3 py-2.5 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Field label="Full name" htmlFor="fullName" error={e.fullName?.message} required>
        <Input id="fullName" autoComplete="name" aria-invalid={Boolean(e.fullName)} {...register("fullName")} />
      </Field>
      <Field label="Email" htmlFor="email" error={e.email?.message} required>
        <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={Boolean(e.email)} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={e.password?.message} hint="8+ characters with a letter and a number." required>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(e.password)} {...register("password")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="I am a" htmlFor="category" error={e.category?.message}>
          <NativeSelect id="category" {...register("category")}>
            {PARTICIPANT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={category === "host_student" || category === "faculty" || category === "staff" ? "Department" : "Institution"} htmlFor="institution" error={e.institution?.message}>
          <Input id="institution" autoComplete="organization" {...register("institution")} />
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Create account
      </Button>
      <p className="text-center text-xs text-muted-foreground">Everyone starts as a participant. Want to host events? Apply from your profile.</p>
    </form>
  );
}
