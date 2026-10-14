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
import {
  EXTERNAL_AFFILIATIONS,
  INSTITUTION_TYPES,
  SRM_AFFILIATIONS,
  SRM_CAMPUSES,
} from "@/lib/constants";
import { organizerApplicationSchema, profileSchema, type ProfileInput } from "@/lib/validation/auth";
import type { z } from "zod";

export function ProfileForm({ defaults }: { defaults: ProfileInput }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState, reset, watch } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });
  const e = formState.errors;
  const instType = watch("institutionType") ?? "SRM";

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
        <Field label="Where are you from?" htmlFor="institutionType" error={e.institutionType?.message}>
          <NativeSelect id="institutionType" {...register("institutionType")}>
            {INSTITUTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Phone" htmlFor="phone" error={e.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel" aria-invalid={Boolean(e.phone)} {...register("phone")} />
        </Field>
      </div>

      {instType === "SRM" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SRM Campus" htmlFor="campus" error={e.campus?.message} required>
            <NativeSelect id="campus" {...register("campus")}>
              {SRM_CAMPUSES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Affiliation" htmlFor="affiliation" error={e.affiliation?.message} required>
            <NativeSelect id="affiliation" {...register("affiliation")}>
              {SRM_AFFILIATIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Department / Branch" htmlFor="department" error={e.department?.message}>
              <Input id="department" placeholder="e.g. Computing, ECE, Mechanical" {...register("department")} />
            </Field>
          </div>
        </div>
      )}

      {instType === "EXTERNAL_INSTITUTION" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Institution / College Name" htmlFor="institutionName" error={e.institutionName?.message} required>
              <Input id="institutionName" placeholder="e.g. VIT Chennai, IIT Madras" {...register("institutionName")} />
            </Field>

            <Field label="City" htmlFor="city" error={e.city?.message} required>
              <Input id="city" placeholder="e.g. Chennai, Vellore" {...register("city")} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Affiliation" htmlFor="affiliation" error={e.affiliation?.message} required>
              <NativeSelect id="affiliation" {...register("affiliation")}>
                {EXTERNAL_AFFILIATIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Department (optional)" htmlFor="department" error={e.department?.message}>
              <Input id="department" placeholder="e.g. Computer Science" {...register("department")} />
            </Field>
          </div>
        </div>
      )}

      {instType === "GUEST" && (
        <div className="rounded-lg border bg-muted/40 p-3.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">External Guest</span> — You are registered as an external visitor. No institution or campus affiliation required.
        </div>
      )}

      <div className="flex justify-end pt-2">
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
