import type { z } from "zod";
import { PARTICIPANT_CATEGORIES } from "@/lib/constants";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import type { eventSchema } from "@/lib/validation/event";

type FormIn = z.input<typeof eventSchema>;

export function shiftLocal(local: string, minutes: number) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return local;
  return toLocalInput(new Date(fromLocalInput(local).getTime() + minutes * 60_000));
}

export function defaultEventValues(): FormIn {
  const start = new Date(Date.now() + 7 * 86400_000);
  const startLocal = `${toLocalInput(start).slice(0, 10)}T10:00`;
  const endLocal = `${startLocal.slice(0, 10)}T13:00`;
  return {
    title: "",
    summary: "",
    description: "",
    category: "technical",
    venue: "",
    startAt: startLocal,
    endAt: endLocal,
    registrationClosesAt: shiftLocal(startLocal, -120),
    checkinOpensAt: shiftLocal(startLocal, -60),
    checkinClosesAt: endLocal,
    visibility: "public",
    maxTicketsPerBooking: 4,
    eligibleCategories: PARTICIPANT_CATEGORIES.map((c) => c.value),
    allowPassRequests: false,
    eligibleInstitutionTypes: ["SRM", "EXTERNAL_INSTITUTION", "GUEST"],
    eligibleCampuses: ["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"],
    eligibleInstitutions: [],
    tiers: [{ id: "", name: "General", description: "", priceRupees: 0, capacity: 100 }],
  };
}

