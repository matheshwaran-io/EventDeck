import { z } from "zod";
import { MAX_TICKETS_PER_PERSON } from "@/lib/constants";
import { campusEnum, eventCategory, institutionType, participantCategory } from "@/db/schema";

const dt = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time");

export const tierSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name the tier").max(40, "Keep it under 40 characters"),
  description: z.string().trim().max(160, "Keep it under 160 characters").default(""),
  priceRupees: z.coerce
    .number({ message: "Enter a price" })
    .min(0, "Price can't be negative")
    .max(100000, "That's above the ₹1,00,000 limit")
    .refine((v) => Math.round(v * 100) === v * 100, "Use at most two decimals"),
  capacity: z.coerce.number({ message: "Enter a capacity" }).int("Whole numbers only").min(1, "At least 1").max(100000),
});

export const eventSchema = z
  .object({
    title: z.string().trim().min(3, "At least 3 characters").max(120, "Keep it under 120 characters"),
    summary: z.string().trim().min(10, "Add a one-line summary (10+ characters)").max(200, "Keep it under 200 characters"),
    description: z.string().trim().max(8000, "Keep it under 8,000 characters").default(""),
    category: z.enum(eventCategory.enumValues),
    venue: z.string().trim().min(2, "Where is it happening?").max(160),
    startAt: dt,
    endAt: dt,
    registrationClosesAt: dt,
    checkinOpensAt: dt,
    checkinClosesAt: dt,
    visibility: z.enum(["public", "unlisted"]),
    maxTicketsPerBooking: z.coerce.number().int().min(1, "At least 1").max(MAX_TICKETS_PER_PERSON, `Up to ${MAX_TICKETS_PER_PERSON} tickets per person`),
    eligibleCategories: z.array(z.enum(participantCategory.enumValues)).min(1, "Choose at least one group"),
    allowPassRequests: z.boolean().default(false),
    eligibleInstitutionTypes: z
      .array(z.enum(institutionType.enumValues))
      .min(1, "Choose at least one audience")
      .default(["SRM", "EXTERNAL_INSTITUTION", "GUEST"]),
    eligibleCampuses: z.array(z.enum(campusEnum.enumValues)).default(["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"]),
    eligibleInstitutions: z
      .array(z.string().trim().min(2, "Institution names need 2+ characters").max(120))
      .max(25, "Up to 25 approved institutions")
      .default([]),
    tiers: z.array(tierSchema).min(1, "Add at least one ticket tier").max(8, "Up to 8 tiers"),
  })
  .superRefine((v, ctx) => {
    if (v.endAt <= v.startAt) ctx.addIssue({ code: "custom", path: ["endAt"], message: "Must end after it starts" });
    if (v.registrationClosesAt > v.endAt)
      ctx.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "Must close before the event ends" });
    if (v.checkinClosesAt <= v.checkinOpensAt)
      ctx.addIssue({ code: "custom", path: ["checkinClosesAt"], message: "Must be after check-in opens" });
    if (v.eligibleInstitutionTypes.includes("SRM") && v.eligibleCampuses.length === 0)
      ctx.addIssue({ code: "custom", path: ["eligibleCampuses"], message: "Choose at least one SRM campus" });
    const names = v.tiers.map((t) => t.name.trim().toLowerCase());
    names.forEach((n, i) => {
      if (names.indexOf(n) !== i) ctx.addIssue({ code: "custom", path: ["tiers", i, "name"], message: "Tier names must be unique" });
    });
  });

export type EventInput = z.input<typeof eventSchema>;
export type EventParsed = z.output<typeof eventSchema>;
