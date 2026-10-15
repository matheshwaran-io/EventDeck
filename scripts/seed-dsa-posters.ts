/**
 * Publishes the Directorate of Student Affairs (DSA) poster events.
 *
 *   npm run seed:dsa
 *
 * Uses the same code paths as the organizer UI: Zod validation, createEvent,
 * poster sniffing/compression (uploadPoster) and setPoster. Idempotent: an event
 * whose title already exists for the DSA organizer is skipped.
 *
 * Dates: each poster's printed day/month moved to its next upcoming occurrence
 * (the artwork still shows the original printed year). Times, end times and
 * capacities not printed on a poster are placeholders — edit them in the
 * organizer dashboard.
 */
import "./_env";
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, profiles } from "@/db/schema";
import { createEvent, setPoster } from "@/lib/server/events";
import { uploadPoster } from "@/lib/server/storage";
import { eventSchema, type EventInput } from "@/lib/validation/event";

const DSA_EMAIL = (process.env.DSA_ORGANIZER_EMAIL ?? "dsa.events@eventdeck.test").toLowerCase();
const ALL_CATEGORIES = ["host_student", "external_student", "faculty", "staff", "alumni", "guest"] as const;
const shift = (local: string, minutes: number) => {
  const d = new Date(new Date(`${local}:00+05:30`).getTime() + minutes * 60_000);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
const schedule = (start: string, hours: number) => {
  const end = shift(start, hours * 60);
  return { startAt: start, endAt: end, registrationClosesAt: shift(start, -120), checkinOpensAt: shift(start, -60), checkinClosesAt: end };
};

type Seed = { poster: string; input: Omit<EventInput, "maxTicketsPerBooking" | "eligibleCategories" | "allowPassRequests" | "visibility"> };

const SEEDS: Seed[] = [
  {
    poster: "rendezvous-freshers.webp",
    input: {
      title: "Rendezvous '25 2.0 — Fresher's Evening",
      summary: "The Directorate of Student Affairs welcomes the new batch with an evening of live music, dance and performances.",
      description:
        "Fresher's Evening is the Directorate of Student Affairs' welcome to the incoming batch — an afternoon-to-evening line-up of student bands, dance crews and performers at the Dr. T.P. Ganesan Auditorium.\n\nEntry is free for SRM KTR students. Register here to get your QR entry pass instantly, and show it at the auditorium entrance.",
      category: "cultural",
      venue: "Dr. T.P. Ganesan Auditorium, SRM KTR",
      ...schedule("2026-10-26T14:30", 4),
      eligibleInstitutionTypes: ["SRM"],
      eligibleCampuses: ["KTR"],
      eligibleInstitutions: [],
      tiers: [{ name: "Free entry", description: "One QR pass per attendee", priceRupees: 0, capacity: 1200 }],
    },
  },
  {
    poster: "namma-chennai.webp",
    input: {
      title: "Namma Chennai — SRM Celebration",
      summary: "Made of Chennai by The Hindu, powered by SRM: a trivia quiz, a photography contest and student journalist articles.",
      description:
        "Three ways to celebrate the city:\n\nTrivia Quiz — test your Chennai quotient.\n\nPhotography Contest — \"My Chennai, My Story\": the city through the lens of a student.\n\nStudent Journalist Articles — \"My Chennai: Memories from Home\" and \"What Makes Chennai Unique?\".\n\nAs announced on the poster, students must register with their SRM e-mail ID, so this event is open to SRM members across campuses.",
      category: "cultural",
      venue: "SRM KTR Campus",
      ...schedule("2026-11-14T10:00", 6),
      eligibleInstitutionTypes: ["SRM"],
      eligibleCampuses: ["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"],
      eligibleInstitutions: [],
      tiers: [{ name: "Participant", description: "Quiz, photography and writing tracks", priceRupees: 0, capacity: 500 }],
    },
  },
  {
    poster: "digital-poster-workshop.webp",
    input: {
      title: "Digital Poster Making Workshop",
      summary: "A hands-on session on designing cool event posters — layout, type and colour for creative arts and tech.",
      description:
        "Born to create cool posters? Join the Digital Poster Making Workshop and learn how event posters like the ones on EventDeck are made — composition, typography, colour and exporting for print and social media.\n\nBring a laptop with your preferred design tool. Seats are limited so everyone gets hands-on time.",
      category: "workshop",
      venue: "SRM KTR Campus",
      ...schedule("2027-01-20T10:00", 3),
      eligibleInstitutionTypes: ["SRM"],
      eligibleCampuses: ["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"],
      eligibleInstitutions: [],
      tiers: [{ name: "Workshop seat", description: "Hands-on, bring a laptop", priceRupees: 0, capacity: 60 }],
    },
  },
  {
    poster: "milan-roadshow.webp",
    input: {
      title: "Milan Roadshow",
      summary: "Milan, SRM's national-level cultural fest, takes to Vendhar Street with its signature roadshow. #LiveTheChange",
      description:
        "The Milan Roadshow kicks off SRM's national-level cultural fest with a parade of colour, music and performances down Vendhar Street.\n\nOpen to students from SRM and other colleges, as well as guests. Register for a free QR pass to enter the viewing zone.",
      category: "cultural",
      venue: "Vendhar Street, SRM KTR",
      ...schedule("2027-02-09T17:00", 3),
      eligibleInstitutionTypes: ["SRM", "EXTERNAL_INSTITUTION", "GUEST"],
      eligibleCampuses: ["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"],
      eligibleInstitutions: [],
      tiers: [{ name: "Free pass", description: "Viewing zone entry", priceRupees: 0, capacity: 2000 }],
    },
  },
  {
    poster: "jhalak-roadshow.webp",
    input: {
      title: "Jhalak '25 Roadshow — Intra-College Competition",
      summary: "Rewind. Replay. Relive. The houses — Astra, Shaurya, Agni, Trishul, Aakash, Brahmos, Nag and Prithvi — compete at Tech Park Stairs.",
      description:
        "Jhalak is the intra-college roadshow competition between SRM KTR's student houses: Astra, Shaurya, Agni, Trishul, Aakash, Brahmos, Nag and Prithvi.\n\nAs an intra-college event it is open to SRM KTR students only.",
      category: "cultural",
      venue: "Tech Park Stairs, SRM KTR",
      ...schedule("2027-02-12T17:00", 3),
      eligibleInstitutionTypes: ["SRM"],
      eligibleCampuses: ["KTR"],
      eligibleInstitutions: [],
      tiers: [{ name: "Audience pass", description: "Watch the house competition", priceRupees: 0, capacity: 800 }],
    },
  },
  {
    poster: "treasure-hunt.webp",
    input: {
      title: "Treasure Hunt — Milan",
      summary: "Follow the clues across the University Building in Milan's national-level treasure hunt.",
      description:
        "Part of Milan, SRM's national-level cultural fest. Teams follow a trail of clues across the University Building — the first to decode the final location wins.\n\nOpen to SRM students, students from other colleges and guests. Each person can register up to 4 passes, so book together with your team.",
      category: "cultural",
      venue: "University Building, SRM KTR",
      ...schedule("2027-02-16T10:00", 3),
      eligibleInstitutionTypes: ["SRM", "EXTERNAL_INSTITUTION", "GUEST"],
      eligibleCampuses: ["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"],
      eligibleInstitutions: [],
      tiers: [{ name: "Hunter pass", description: "One pass per team member", priceRupees: 0, capacity: 200 }],
    },
  },
];

async function ensureOrganizer() {
  const [existing] = await db.select().from(profiles).where(sql`lower(${profiles.email}) = ${DSA_EMAIL}`);
  if (existing) return existing;
  const password = `${randomBytes(12).toString("base64url")}Aa1!`;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.createUser({
    email: DSA_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Directorate of Student Affairs" },
  });
  if (error || !data.user) throw new Error(`Could not create the DSA organizer: ${error?.message}`);
  // Record the password only in the git-ignored env file — never print it.
  appendFileSync(process.env.ENV_FILE ?? ".env.local", `\n# DSA organizer account created by seed:dsa\nDSA_ORGANIZER_EMAIL=${DSA_EMAIL}\nDSA_ORGANIZER_PASSWORD=${password}\n`);
  const [p] = await db
    .update(profiles)
    .set({
      role: "organizer",
      fullName: "Directorate of Student Affairs",
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "STAFF",
      institutionName: "SRM University",
      institution: "SRM KTR — Directorate of Student Affairs",
      category: "staff",
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, data.user.id))
    .returning();
  console.log(`✓ Created organizer ${DSA_EMAIL} (password saved to ${process.env.ENV_FILE ?? ".env.local"} as DSA_ORGANIZER_PASSWORD)`);
  return p!;
}

async function main() {
  const org = await ensureOrganizer();
  for (const seed of SEEDS) {
    const [dup] = await db.select({ id: events.id }).from(events).where(and(eq(events.organizerId, org.id), eq(events.title, seed.input.title)));
    if (dup) {
      console.log(`· Skipped (exists): ${seed.input.title}`);
      continue;
    }
    const parsed = eventSchema.parse({
      ...seed.input,
      visibility: "public",
      maxTicketsPerBooking: 4,
      eligibleCategories: [...ALL_CATEGORIES],
      allowPassRequests: false,
    });
    const event = await createEvent(org, parsed, true);
    const bytes = readFileSync(path.join("scripts", "demo-posters", seed.poster));
    const file = new File([new Uint8Array(bytes)], seed.poster, { type: "image/webp" });
    const posterPath = await uploadPoster(file, event.id);
    await setPoster(org, event.id, posterPath);
    console.log(`✓ Published: ${event.title} → /events/${event.slug}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
