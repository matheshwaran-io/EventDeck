import { describe, expect, it } from "vitest";
import { toCsv, csvCell } from "@/lib/csv";
import { fromLocalInput, toLocalInput, formatPaise } from "@/lib/format";
import { priceOrder, PricingError } from "@/lib/domain/pricing";
import { eventCode, parseScan, qrPayload, qrToken, slugify } from "@/lib/domain/tokens";
import { BOOKING_TRANSITIONS, canTransition, assertBookingTransition, ticketsShouldBeValid, TransitionError } from "@/lib/domain/transitions";
import { eventSchema } from "@/lib/validation/event";
import { signupSchema } from "@/lib/validation/auth";

describe("booking state machine", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition(BOOKING_TRANSITIONS, "awaiting_payment", "pending_verification")).toBe(true);
    expect(canTransition(BOOKING_TRANSITIONS, "pending_verification", "approved")).toBe(true);
    expect(canTransition(BOOKING_TRANSITIONS, "awaiting_payment", "approved")).toBe(false); // must be paid + verified
    expect(canTransition(BOOKING_TRANSITIONS, "approved", "cancelled")).toBe(false); // no individual refunds
    expect(canTransition(BOOKING_TRANSITIONS, "rejected", "approved")).toBe(false);
    expect(() => assertBookingTransition("event_cancelled", "approved")).toThrow(TransitionError);
  });

  it("terminal states have no exits", () => {
    for (const s of ["rejected", "event_cancelled", "payment_exception"] as const) expect(BOOKING_TRANSITIONS[s]).toEqual([]);
  });

  it("tickets are valid only when every gate passes", () => {
    expect(ticketsShouldBeValid({ bookingStatus: "approved", paymentStatus: "paid", eventStatus: "published" })).toBe(true);
    expect(ticketsShouldBeValid({ bookingStatus: "approved", paymentStatus: "not_required", eventStatus: "published" })).toBe(true);
    expect(ticketsShouldBeValid({ bookingStatus: "pending_verification", paymentStatus: "paid", eventStatus: "published" })).toBe(false);
    expect(ticketsShouldBeValid({ bookingStatus: "approved", paymentStatus: "pending", eventStatus: "published" })).toBe(false);
    expect(ticketsShouldBeValid({ bookingStatus: "approved", paymentStatus: "paid", eventStatus: "cancelled" })).toBe(false);
  });
});

describe("server-side pricing", () => {
  const tiers = [
    { id: "a", pricePaise: 14900, capacity: 10, allocated: 0 },
    { id: "b", pricePaise: 0, capacity: 10, allocated: 0 },
  ];
  it("prices from database rows and merges duplicate lines", () => {
    expect(priceOrder([{ tierId: "a", quantity: 1 }, { tierId: "a", quantity: 1 }, { tierId: "b", quantity: 1 }], tiers, 4)).toEqual({
      items: [
        { tierId: "a", quantity: 2, unitPricePaise: 14900 },
        { tierId: "b", quantity: 1, unitPricePaise: 0 },
      ],
      quantity: 3,
      amountPaise: 29800,
    });
  });
  it("rejects empty, oversized, negative, fractional and unknown lines", () => {
    expect(() => priceOrder([{ tierId: "a", quantity: 0 }], tiers, 4)).toThrow(PricingError);
    expect(() => priceOrder([{ tierId: "a", quantity: 5 }], tiers, 4)).toThrow(/up to 4/);
    expect(() => priceOrder([{ tierId: "a", quantity: -1 }], tiers, 4)).toThrow(PricingError);
    expect(() => priceOrder([{ tierId: "a", quantity: 1.5 }], tiers, 4)).toThrow(PricingError);
    expect(() => priceOrder([{ tierId: "zzz", quantity: 1 }], tiers, 4)).toThrow(/not available/);
  });
});

describe("tickets & QR", () => {
  it("generates unguessable, unique tokens", () => {
    const set = new Set(Array.from({ length: 2000 }, qrToken));
    expect(set.size).toBe(2000);
    expect([...set][0]).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
  it("parses QR payloads, raw tokens and typed ticket numbers; rejects junk", () => {
    const t = qrToken();
    expect(parseScan(qrPayload(t))).toEqual({ kind: "token", value: t });
    expect(parseScan(` ${t} `)).toEqual({ kind: "token", value: t });
    expect(parseScan("hn2-ab3c-de4f")).toEqual({ kind: "number", value: "HN2-AB3C-DE4F" });
    expect(parseScan("https://evil.example/?x=1")).toBeNull();
    expect(parseScan("EVD1:short")).toBeNull();
    expect(parseScan("")).toBeNull();
  });
  it("derives readable event codes and unique slugs", () => {
    expect(eventCode("HackNorth 2026: Build Sprint")).toBe("H2BS");
    expect(slugify("Raag & Rhythm — Fusion!")).toMatch(/^raag-rhythm-fusion-[a-z0-9]{5}$/);
    expect(slugify("Raag & Rhythm")).not.toBe(slugify("Raag & Rhythm"));
  });
});

describe("CSV export safety", () => {
  it("neutralises spreadsheet formulas and quotes properly", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+1 555")).toBe("'+1 555");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell(-25)).toBe("-25"); // genuine numbers untouched
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell(null)).toBe("");
    expect(toCsv(["h"], [["x"]])).toBe("h\r\nx\r\n");
  });
});

describe("campus time & money formatting", () => {
  it("round-trips datetime-local values in IST", () => {
    const d = fromLocalInput("2026-10-20T18:30");
    expect(d.toISOString()).toBe("2026-10-20T13:00:00.000Z");
    expect(toLocalInput(d)).toBe("2026-10-20T18:30");
  });
  it("formats paise as rupees", () => {
    expect(formatPaise(0)).toBe("Free");
    expect(formatPaise(14900)).toBe("₹149");
    expect(formatPaise(14950)).toBe("₹149.50");
  });
});

describe("validation schemas", () => {
  const valid = {
    title: "Test event",
    summary: "A sufficiently long summary",
    description: "",
    category: "technical",
    venue: "Hall A",
    startAt: "2030-01-10T10:00",
    endAt: "2030-01-10T12:00",
    registrationClosesAt: "2030-01-10T08:00",
    checkinOpensAt: "2030-01-10T09:00",
    checkinClosesAt: "2030-01-10T12:00",
    visibility: "public",
    maxTicketsPerBooking: 4,
    eligibleCategories: ["host_student"],
    allowPassRequests: false,
    tiers: [{ name: "Gold", priceRupees: "349", capacity: "80" }],
  };
  it("accepts a well-formed event and coerces numbers", () => {
    const r = eventSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tiers[0]!.priceRupees).toBe(349);
  });
  it("enforces time ordering, unique tier names and price precision", () => {
    expect(eventSchema.safeParse({ ...valid, endAt: "2030-01-10T09:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...valid, registrationClosesAt: "2030-01-11T08:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...valid, checkinClosesAt: "2030-01-10T08:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...valid, tiers: [valid.tiers[0], { ...valid.tiers[0], name: "gold" }] }).success).toBe(false);
    expect(eventSchema.safeParse({ ...valid, tiers: [{ ...valid.tiers[0], priceRupees: "1.234" }] }).success).toBe(false);
    expect(eventSchema.safeParse({ ...valid, eligibleCategories: [] }).success).toBe(false);
  });
  it("signup never accepts a role and requires a reasonable password", () => {
    const parsed = signupSchema.parse({ fullName: "Asha", email: "A@B.CO", password: "secret123", category: "guest", role: "admin" } as never);
    expect(parsed).not.toHaveProperty("role");
    expect(parsed.email).toBe("a@b.co");
    expect(signupSchema.safeParse({ fullName: "Asha", email: "a@b.co", password: "short", category: "guest" }).success).toBe(false);
  });
});
