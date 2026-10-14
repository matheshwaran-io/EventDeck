"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Plus, Trash2, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { createEventAction, updateEventAction } from "@/app/actions/organizer";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_CATEGORIES, MAX_POSTER_BYTES, PARTICIPANT_CATEGORIES } from "@/lib/constants";
import { posterUrl } from "@/lib/poster";
import { cn } from "@/lib/utils";
import { eventSchema } from "@/lib/validation/event";
import { shiftLocal as shift } from "@/lib/event-defaults";

type FormIn = z.input<typeof eventSchema>;
type FormOut = z.output<typeof eventSchema>;

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

function firstError(errors: FieldErrors<FormIn>): string | null {
  for (const v of Object.values(errors)) {
    if (!v) continue;
    if (typeof (v as { message?: unknown }).message === "string") return (v as { message: string }).message;
    if (typeof v === "object") {
      const nested = firstError(v as FieldErrors<FormIn>);
      if (nested) return nested;
    }
  }
  return null;
}

export function EventForm({
  mode,
  eventId,
  defaults,
  currentPoster,
  allocatedByTier = {},
  isPublished,
}: {
  mode: "create" | "edit";
  eventId?: string;
  defaults: FormIn;
  currentPoster?: string | null;
  allocatedByTier?: Record<string, number>;
  isPublished?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [intent, setIntent] = useState<"draft" | "publish" | "save">("save");
  const [poster, setPoster] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(posterUrl(currentPoster));
  const [removePoster, setRemovePoster] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(eventSchema), defaultValues: defaults, mode: "onTouched" });
  const { register, handleSubmit, formState, control, watch, setValue, getValues } = form;
  const tiers = useFieldArray({ control, name: "tiers" });
  const e = formState.errors;
  const eligible = watch("eligibleCategories") ?? [];

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const pickPoster = (file: File | undefined) => {
    setPosterError(null);
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return setPosterError("Use a JPG, PNG or WebP image.");
    if (file.size > MAX_POSTER_BYTES) return setPosterError(`That file is ${(file.size / 1048576).toFixed(1)} MB — the limit is 2 MB.`);
    setPoster(file);
    setRemovePoster(false);
    setPreview(URL.createObjectURL(file));
  };

  const suggestTimes = () => {
    const s = getValues("startAt");
    const end = getValues("endAt");
    setValue("registrationClosesAt", shift(s, -120), { shouldDirty: true, shouldValidate: true });
    setValue("checkinOpensAt", shift(s, -60), { shouldDirty: true, shouldValidate: true });
    setValue("checkinClosesAt", end, { shouldDirty: true, shouldValidate: true });
    toast("Registration closes 2h before start; check-in opens 1h before and closes at the end.");
  };

  const onSubmit = handleSubmit(
    (values) =>
      start(async () => {
        const fd = new FormData();
        fd.set("payload", JSON.stringify(values));
        fd.set("intent", intent);
        if (poster) fd.set("poster", poster);
        if (removePoster) fd.set("removePoster", "1");
        const res = mode === "create" ? await createEventAction(fd) : await updateEventAction(eventId!, fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(res.message ?? "Saved");
        if (mode === "create" && res.data && "eventId" in res.data) router.push(`/organizer/events/${(res.data as { eventId: string }).eventId}`);
        else {
          setPoster(null);
          form.reset(values as FormIn);
          router.refresh();
        }
      }),
    (errs) => toast.error(firstError(errs) ?? "Please fix the highlighted fields."),
  );

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6 pb-28" noValidate>
      <Section title="Basics" description="What attendees see first.">
        <Field label="Title" htmlFor="title" error={e.title?.message} required>
          <Input id="title" aria-invalid={Boolean(e.title)} placeholder="e.g. HackNorth 2026" {...register("title")} />
        </Field>
        <Field label="One-line summary" htmlFor="summary" error={e.summary?.message} hint="Shown on event cards and search results." required>
          <Input id="summary" aria-invalid={Boolean(e.summary)} maxLength={200} {...register("summary")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="category" error={e.category?.message}>
            <NativeSelect id="category" {...register("category")}>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Venue" htmlFor="venue" error={e.venue?.message} required>
            <Input id="venue" aria-invalid={Boolean(e.venue)} placeholder="Building, room or ground" {...register("venue")} />
          </Field>
        </div>
        <Field label="Description" htmlFor="description" error={e.description?.message} hint="Plain text. Leave a blank line between paragraphs.">
          <Textarea id="description" className="min-h-40" {...register("description")} />
        </Field>
      </Section>

      <Section
        title="Schedule"
        description="All times are campus time (IST)."
        action={
          <Button type="button" variant="outline" size="sm" onClick={suggestTimes}>
            <Wand2 /> Suggest windows
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" htmlFor="startAt" error={e.startAt?.message} required>
            <Input id="startAt" type="datetime-local" aria-invalid={Boolean(e.startAt)} {...register("startAt")} />
          </Field>
          <Field label="Ends" htmlFor="endAt" error={e.endAt?.message} required>
            <Input id="endAt" type="datetime-local" aria-invalid={Boolean(e.endAt)} {...register("endAt")} />
          </Field>
          <Field label="Registration closes" htmlFor="registrationClosesAt" error={e.registrationClosesAt?.message} hint="No new bookings after this, even if seats remain." required>
            <Input id="registrationClosesAt" type="datetime-local" aria-invalid={Boolean(e.registrationClosesAt)} {...register("registrationClosesAt")} />
          </Field>
          <div />
          <Field label="Check-in opens" htmlFor="checkinOpensAt" error={e.checkinOpensAt?.message} required>
            <Input id="checkinOpensAt" type="datetime-local" aria-invalid={Boolean(e.checkinOpensAt)} {...register("checkinOpensAt")} />
          </Field>
          <Field label="Check-in closes" htmlFor="checkinClosesAt" error={e.checkinClosesAt?.message} required>
            <Input id="checkinClosesAt" type="datetime-local" aria-invalid={Boolean(e.checkinClosesAt)} {...register("checkinClosesAt")} />
          </Field>
        </div>
      </Section>

      <Section title="Ticket tiers" description="Prices in rupees. Use 0 for free tiers. Capacity can't drop below seats already taken.">
        <div className="space-y-3">
          {tiers.fields.map((f, i) => {
            const te = e.tiers?.[i];
            const id = getValues(`tiers.${i}.id`) as string | undefined;
            const taken = id ? (allocatedByTier[id] ?? 0) : 0;
            return (
              <div key={f.id} className="rounded-xl border bg-secondary/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="eyebrow">Tier {i + 1}</p>
                  <div className="flex items-center gap-3">
                    {taken > 0 && <span className="text-xs text-muted-foreground">{taken} seat(s) taken</span>}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove tier ${i + 1}`}
                      disabled={tiers.fields.length === 1 || taken > 0}
                      onClick={() => tiers.remove(i)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <input type="hidden" {...register(`tiers.${i}.id`)} />
                <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr]">
                  <Field label="Name" htmlFor={`tier-name-${i}`} error={te?.name?.message}>
                    <Input id={`tier-name-${i}`} placeholder="Silver, Gold, VIP…" aria-invalid={Boolean(te?.name)} {...register(`tiers.${i}.name`)} />
                  </Field>
                  <Field label="Price (₹)" htmlFor={`tier-price-${i}`} error={te?.priceRupees?.message}>
                    <Input id={`tier-price-${i}`} type="number" inputMode="decimal" min={0} step="0.01" aria-invalid={Boolean(te?.priceRupees)} {...register(`tiers.${i}.priceRupees`)} />
                  </Field>
                  <Field label="Capacity" htmlFor={`tier-cap-${i}`} error={te?.capacity?.message}>
                    <Input id={`tier-cap-${i}`} type="number" inputMode="numeric" min={Math.max(1, taken)} step="1" aria-invalid={Boolean(te?.capacity)} {...register(`tiers.${i}.capacity`)} />
                  </Field>
                </div>
                <Field label="Perks (optional)" htmlFor={`tier-desc-${i}`} error={te?.description?.message} className="mt-3">
                  <Input id={`tier-desc-${i}`} placeholder="e.g. Front-row seating + meet the artists" {...register(`tiers.${i}.description`)} />
                </Field>
              </div>
            );
          })}
        </div>
        {e.tiers?.message && <p className="text-xs font-medium text-destructive">{e.tiers.message}</p>}
        <Button
          type="button"
          variant="outline"
          disabled={tiers.fields.length >= 8}
          onClick={() => tiers.append({ id: "", name: "", description: "", priceRupees: 0, capacity: 50 })}
        >
          <Plus /> Add tier
        </Button>
      </Section>

      <Section title="Access & rules">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Visibility" htmlFor="visibility" hint="Unlisted events are reachable only by direct link.">
            <NativeSelect id="visibility" {...register("visibility")}>
              <option value="public">Public — listed and searchable</option>
              <option value="unlisted">Unlisted — direct link only</option>
            </NativeSelect>
          </Field>
          <Field label="Max tickets per person" htmlFor="maxTicketsPerBooking" error={e.maxTicketsPerBooking?.message}>
            <Input id="maxTicketsPerBooking" type="number" min={1} max={10} {...register("maxTicketsPerBooking")} />
          </Field>
        </div>
        <fieldset>
          <legend className="text-[0.8125rem] font-medium">Who can register</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {PARTICIPANT_CATEGORIES.map((c) => {
              const on = eligible.includes(c.value);
              return (
                <label
                  key={c.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    on ? "border-foreground/40 bg-card" : "text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  <input type="checkbox" value={c.value} className="size-4 accent-[var(--signal)]" {...register("eligibleCategories")} />
                  {c.label}
                </label>
              );
            })}
          </div>
          {e.eligibleCategories?.message && <p className="mt-1.5 text-xs font-medium text-destructive">{e.eligibleCategories.message}</p>}
        </fieldset>
        <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
          <span>
            <span className="block text-sm font-medium">Accept complimentary pass requests</span>
            <span className="block text-xs text-muted-foreground">Participants explain their eligibility; you approve or reject each one.</span>
          </span>
          <Switch checked={Boolean(watch("allowPassRequests"))} onCheckedChange={(v) => setValue("allowPassRequests", v, { shouldDirty: true })} />
        </label>
      </Section>

      <Section title="Poster" description="JPG, PNG or WebP up to 2 MB. We compress it automatically. Without one, a typographic poster is generated.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative aspect-[4/5] w-40 shrink-0 overflow-hidden rounded-xl border bg-secondary">
            {preview && !removePoster ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={preview} alt="Poster preview" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-muted-foreground">
                <ImagePlus className="size-6" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept={ACCEPT.join(",")} className="sr-only" id="poster" onChange={(ev) => pickPoster(ev.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <ImagePlus /> {preview && !removePoster ? "Replace image" : "Upload image"}
              </Button>
              {preview && !removePoster && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPoster(null);
                    setPreview(null);
                    if (currentPoster) setRemovePoster(true);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  <X /> Remove
                </Button>
              )}
            </div>
            {poster && <p className="text-xs text-muted-foreground">{poster.name} · {(poster.size / 1024).toFixed(0)} KB</p>}
            {posterError && <p className="text-xs font-medium text-destructive" role="alert">{posterError}</p>}
          </div>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:pl-[17rem]">
          <p className="mr-auto hidden text-sm text-muted-foreground sm:block">
            {formState.isDirty || poster ? "Unsaved changes" : mode === "edit" ? "All changes saved" : "New event"}
          </p>
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
            Cancel
          </Button>
          {mode === "create" ? (
            <>
              <Button type="submit" variant="outline" disabled={pending} onClick={() => setIntent("draft")}>
                {pending && intent === "draft" && <Loader2 className="animate-spin" />} Save draft
              </Button>
              <Button type="submit" disabled={pending} onClick={() => setIntent("publish")}>
                {pending && intent === "publish" && <Loader2 className="animate-spin" />} Publish now
              </Button>
            </>
          ) : (
            <Button type="submit" disabled={pending || (!formState.isDirty && !poster && !removePoster)} onClick={() => setIntent("save")}>
              {pending && <Loader2 className="animate-spin" />} {isPublished ? "Save & update live event" : "Save changes"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="surface grid gap-5 p-5 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}
