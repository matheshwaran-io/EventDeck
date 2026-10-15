import { describe, expect, it } from "vitest";
import { checkEligibility, describeAudience, normaliseInstitution, parseInstitutionList } from "@/lib/domain/eligibility";
import { bookingRequestSchema } from "@/lib/validation/booking";

const open = {
  eligibleCategories: ["host_student", "external_student", "faculty", "staff", "alumni", "guest"] as const,
  eligibleInstitutionTypes: ["SRM", "EXTERNAL_INSTITUTION", "GUEST"] as const,
  eligibleCampuses: ["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"] as const,
  eligibleInstitutions: [] as string[],
};
const ev = (o: Partial<Record<keyof typeof open, unknown>> = {}) => ({ ...open, ...o }) as never;
const srm = (campus: string | null, category = "host_student") => ({ institutionType: "SRM", campus, category, institutionName: "SRM University" }) as never;
const ext = (name: string, category = "external_student") => ({ institutionType: "EXTERNAL_INSTITUTION", campus: null, category, institutionName: name }) as never;
const guest = { institutionType: "GUEST", campus: null, category: "guest", institutionName: null } as never;

describe("event audience eligibility", () => {
  it("open events accept every audience", () => {
    for (const u of [srm("KTR"), srm("VADAPALANI"), ext("VIT"), guest]) expect(checkEligibility(ev(), u).ok).toBe(true);
  });

  it("campus-only events accept only that campus", () => {
    const ktrOnly = ev({ eligibleInstitutionTypes: ["SRM"], eligibleCampuses: ["KTR"] });
    expect(checkEligibility(ktrOnly, srm("KTR")).ok).toBe(true);
    const r = checkEligibility(ktrOnly, srm("RAMAPURAM"));
    expect(r).toEqual({ ok: false, reason: "This event is limited to SRM KTR." });
    expect(checkEligibility(ktrOnly, ext("VIT")).ok).toBe(false);
    expect(checkEligibility(ktrOnly, guest).ok).toBe(false);
  });

  it("inter-campus events accept only the selected campuses", () => {
    const e = ev({ eligibleInstitutionTypes: ["SRM"], eligibleCampuses: ["KTR", "RAMAPURAM"] });
    expect(checkEligibility(e, srm("RAMAPURAM")).ok).toBe(true);
    expect(checkEligibility(e, srm("VADAPALANI")).ok).toBe(false);
    expect(checkEligibility(e, srm(null)).ok).toBe(false);
  });

  it("inter-college events accept only approved institutions (normalised names)", () => {
    const e = ev({ eligibleInstitutionTypes: ["SRM", "EXTERNAL_INSTITUTION"], eligibleInstitutions: ["VIT", "Anna University"] });
    expect(checkEligibility(e, ext("vit")).ok).toBe(true);
    expect(checkEligibility(e, ext("  Anna   University. ")).ok).toBe(true);
    expect(checkEligibility(e, ext("Loyola College")).ok).toBe(false);
    expect(checkEligibility(e, ext("")).ok).toBe(false);
    expect(checkEligibility(e, srm("KTR")).ok).toBe(true);
    expect(checkEligibility(e, guest).ok).toBe(false);
  });

  it("category rules still apply on top of institution rules", () => {
    const facultyOnly = ev({ eligibleCategories: ["faculty"] });
    expect(checkEligibility(facultyOnly, srm("KTR")).ok).toBe(false);
    expect(checkEligibility(facultyOnly, srm("KTR", "faculty")).ok).toBe(true);
  });

  it("labels audiences accurately", () => {
    expect(describeAudience(ev()).label).toBe("Open to all");
    expect(describeAudience(ev({ eligibleInstitutionTypes: ["SRM"], eligibleCampuses: ["KTR"] })).label).toBe("SRM KTR only");
    expect(describeAudience(ev({ eligibleInstitutionTypes: ["SRM"], eligibleCampuses: ["KTR", "RAMAPURAM"] })).label).toBe("SRM KTR & Ramapuram · inter-campus");
    expect(describeAudience(ev({ eligibleInstitutionTypes: ["SRM"] })).label).toBe("SRM only · inter-campus");
    expect(describeAudience(ev({ eligibleInstitutionTypes: ["SRM", "EXTERNAL_INSTITUTION"], eligibleInstitutions: ["VIT", "Anna University"] })).label).toBe(
      "All SRM campuses + VIT, Anna University",
    );
  });

  it("parses approved-institution lists and normalises names", () => {
    expect(parseInstitutionList("VIT, Anna University\nvit;  Loyola  College ")).toEqual(["VIT", "Anna University", "Loyola College"]);
    expect(normaliseInstitution("Anna-University.")).toBe("anna university");
  });

  it("booking requests cannot smuggle profile fields past validation", () => {
    const parsed = bookingRequestSchema.parse({
      eventId: "00000000-0000-4000-8000-000000000000",
      idempotencyKey: "key-12345678",
      lines: [{ tierId: "00000000-0000-4000-8000-000000000001", quantity: 1 }],
      attendeeNames: [],
      institutionType: "SRM",
      campus: "KTR",
      category: "host_student",
      userId: "someone-else",
    });
    expect(parsed).not.toHaveProperty("institutionType");
    expect(parsed).not.toHaveProperty("campus");
    expect(parsed).not.toHaveProperty("category");
    expect(parsed).not.toHaveProperty("userId");
  });
});

describe("platform limit: 4 tickets per person", () => {
  it("event validation refuses a per-person limit above 4", async () => {
    const { eventSchema } = await import("@/lib/validation/event");
    const { MAX_TICKETS_PER_PERSON } = await import("@/lib/constants");
    expect(MAX_TICKETS_PER_PERSON).toBe(4);
    const base = {
      title: "Limit test",
      summary: "A sufficiently long summary",
      description: "",
      category: "cultural",
      venue: "Hall A",
      startAt: "2030-01-10T10:00",
      endAt: "2030-01-10T12:00",
      registrationClosesAt: "2030-01-10T08:00",
      checkinOpensAt: "2030-01-10T09:00",
      checkinClosesAt: "2030-01-10T12:00",
      visibility: "public",
      eligibleCategories: ["host_student"],
      tiers: [{ name: "Entry", priceRupees: 0, capacity: 10 }],
    };
    expect(eventSchema.safeParse({ ...base, maxTicketsPerBooking: 4 }).success).toBe(true);
    const five = eventSchema.safeParse({ ...base, maxTicketsPerBooking: 5 });
    expect(five.success).toBe(false);
    expect(five.error?.issues[0]?.message).toBe("Up to 4 tickets per person");
  });
});
