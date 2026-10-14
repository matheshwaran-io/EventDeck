"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyOrganizerAction, updateProfileAction } from "@/app/actions/profile";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PARTICIPANT_CATEGORIES } from "@/lib/constants";
import { organizerApplicationSchema, profileSchema, type ProfileInput } from "@/lib/validation/auth";
import type { z } from "zod";

export function ProfileForm({ defaults }: { defaults: ProfileInput }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState, reset } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const e = formState.errors;
  const onSubmit = handleSubmit((values) =>
    start(async () => {
      const res = await updateProfileAction(values);
      if (res.ok) {
        toast.success(res.message);
        reset(values);
        router.refresh();
      } else toast.error(res.error);
    }),
  );
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
      <Field label="Full name" htmlFor="fullName" error={e.fullName?.message} required>
        <Input id="fullName" aria-invalid={Boolean(e.fullName)} {...register("fullName")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category" error={e.category?.message}>
          <NativeSelect id="category" {...register("category")}>
            {PARTICIPANT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Phone" htmlFor="phone" error={e.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel" aria-invalid={Boolean(e.phone)} {...register("phone")} />
        </Field>
        <Field label="Institution" htmlFor="institution" error={e.institution?.message}>
          <Input id="institution" {...register("institution")} />
        </Field>
        <Field label="Department" htmlFor="department" error={e.department?.message}>
          <Input id="department" {...register("department")} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !formState.isDirty}>
          {pending && <Loader2 className="animate-spin" />} Save changes
        </Button>
      </div>
    </form>
  );
}

type AppInput = z.input<typeof organizerApplicationSchema>;

export function OrganizerApplicationForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState } = useForm<AppInput>({ resolver: zodResolver(organizerApplicationSchema) });
  const e = formState.errors;
  const onSubmit = handleSubmit((values) =>
    start(async () => {
      const res = await applyOrganizerAction(values);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    }),
  );
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
      <Field label="Club, department or society" htmlFor="organization" error={e.organization?.message} required>
        <Input id="organization" aria-invalid={Boolean(e.organization)} {...register("organization")} />
      </Field>
      <Field label="What events will you run?" htmlFor="reason" error={e.reason?.message} required>
        <Textarea id="reason" aria-invalid={Boolean(e.reason)} {...register("reason")} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Apply for organizer access
      </Button>
    </form>
  );
}
