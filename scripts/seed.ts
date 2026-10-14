/**
 * Demo data for local development and presentations.
 *
 *   npm run db:seed
 *
 * Creates demo accounts (password = SEED_DEMO_PASSWORD), a spread of events
 * across categories, and bookings that exercise every workflow through the
 * real service layer. Safe to re-run: existing demo accounts are reused and
 * events are only created when the demo organizer has none.
 */
import "./_env";
import { randomUUID } from "node:crypto";
import { count, eq, sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { events, profiles, ticketTiers, type Profile } from "@/db/schema";
import { createBooking, decideBooking } from "@/lib/server/bookings";
import { requestCancellation } from "@/lib/server/cancellations";
import { confirmPayment, createOrderForBooking } from "@/lib/server/payments";
import { slugify } from "@/lib/domain/tokens";

const password = process.env.SEED_DEMO_PASSWORD;
if (!password) throw new Error("Set SEED_DEMO_PASSWORD in .env.local");
process.env.ALLOW_MOCK_PAYMENTS = "true";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureUser(email: string, fullName: string, category: Profile["category"], role: Profile["role"], institution?: string) {
  let [p] = await db.select().from(profiles).where(sql`lower(${profiles.email}) = ${email}`);
  if (!p) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, category, institution },
    });
    if (error) throw new Error(`${email}: ${error.message}`);
    [p] = await db.select().from(profiles).where(eq(profiles.id, data.user!.id));
  }
  if (p!.role !== role) [p] = await db.update(profiles).set({ role }).where(eq(profiles.id, p!.id)).returning();
  return p!;
}

const day = 86400_000;
const hour = 3600_000;
function at(daysFromNow: number, hourIST: number, minute = 0) {
  const d = new Date(Date.now() + daysFromNow * day);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  return new Date(`${ymd}T${String(hourIST).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`);
}

type Seed = {
  title: string;
  summary: string;
  description: string;
  category: (typeof events.$inferInsert)["category"];
  venue: string;
  start: Date;
  hours: number;
  tiers: { name: string; description?: string; price: number; capacity: number }[];
  visibility?: "public" | "unlisted";
  status?: "draft" | "published";
  max?: number;
  passes?: boolean;
  eligible?: Profile["category"][];
};

async function main() {
  const admin = await ensureUser("admin@eventdeck.test", "Meera Iyer", "staff", "admin");
  const org = await ensureUser("organizer@eventdeck.test", "Arjun Mehta", "faculty", "organizer", "Dept. of Computer Science");
  const org2 = await ensureUser("cultural@eventdeck.test", "Kavya Rao", "host_student", "organizer", "Cultural Council");
  const p1 = await ensureUser("participant@eventdeck.test", "Riya Sharma", "host_student", "participant", "Northfield University");
  const p2 = await ensureUser("guest@eventdeck.test", "Daniel Thomas", "external_student", "participant", "St. Joseph's College");
  const p3 = await ensureUser("aditi@eventdeck.test", "Aditi Nair", "host_student", "participant", "Northfield University");
  await ensureUser("applicant@eventdeck.test", "Farhan Ali", "host_student", "participant", "Robotics Society");

  const [{ n }] = await db.select({ n: count() }).from(events).where(eq(events.organizerId, org.id));
  if (n > 0) {
    console.log("Demo events already exist — accounts refreshed, skipping event creation.");
    process.exit(0);
  }

  const seeds: (Seed & { owner: Profile })[] = [
    {
      owner: org,
      title: "HackNorth 2026: 24-Hour Build Sprint",
      summary: "Form a team, ship something real in 24 hours, and pitch it to industry judges.",
      description:
        "HackNorth is the flagship student hackathon of the School of Engineering.\n\nTeams of up to four build around three open tracks — climate, campus life, and accessible tech. Meals, mentors and a midnight snack run are included. Final pitches are judged by alumni founders and engineers from partner companies.\n\nBring a laptop, a charger, and your student ID.",
      category: "technical",
      venue: "Innovation Centre, Block C",
      start: at(9, 9),
      hours: 24,
      tiers: [
        { name: "Student", description: "Full hackathon access, meals and swag", price: 249, capacity: 120 },
        { name: "Pro", description: "Includes priority mentor slots and a hoodie", price: 499, capacity: 30 },
      ],
      passes: true,
    },
    {
      owner: org2,
      title: "Raag & Rhythm — An Evening of Indian Classical Fusion",
      summary: "Sitar, tabla and a string quartet share one stage for a night under the open sky.",
      description:
        "The Cultural Council presents its annual fusion concert at the amphitheatre. Expect improvisation, call-and-response and a finale that brings every performer on stage.\n\nSeating is tiered: Silver seats are on the lawn, Gold seats in the first terraces, and Diamond seats include front-row cushions and a meet-the-artists session.",
      category: "cultural",
      venue: "Open-Air Amphitheatre",
      start: at(5, 18, 30),
      hours: 3,
      tiers: [
        { name: "Silver", description: "Lawn seating", price: 149, capacity: 200 },
        { name: "Gold", description: "Terrace seating", price: 349, capacity: 80 },
        { name: "Diamond", description: "Front row + meet the artists", price: 799, capacity: 12 },
      ],
      max: 6,
    },
    {
      owner: org,
      title: "Applied Machine Learning Workshop",
      summary: "A hands-on afternoon on fine-tuning small models for real campus datasets.",
      description:
        "Bring a laptop with Python 3.11. We'll walk through data cleaning, evaluation and fine-tuning using open datasets from the university's research groups. Limited seats so every participant gets mentor time.",
      category: "workshop",
      venue: "Computing Lab 2, Main Building",
      start: at(3, 14),
      hours: 3,
      tiers: [{ name: "Participant", price: 0, capacity: 40 }],
      eligible: ["host_student", "faculty", "staff"],
      max: 1,
    },
    {
      owner: org,
      title: "Research Day: Posters & Lightning Talks",
      summary: "Thirty labs, thirty posters, and ten five-minute talks on the research happening across campus.",
      description:
        "An open day for the whole university community to see what our labs are working on. Grab a coffee, wander the poster hall, and vote for the people's choice award.",
      category: "academic",
      venue: "Central Library Atrium",
      start: at(12, 10),
      hours: 6,
      tiers: [{ name: "General admission", price: 0, capacity: 400 }],
      max: 4,
    },
    {
      owner: org2,
      title: "Inter-College Football Cup — Finals",
      summary: "Northfield takes on St. Joseph's for the cup. Bring your loudest voice.",
      description: "The final of this season's inter-college football cup. Gates open an hour before kickoff.",
      category: "sports",
      venue: "University Stadium",
      start: at(7, 16),
      hours: 2,
      tiers: [
        { name: "Stands", price: 49, capacity: 600 },
        { name: "Pavilion", description: "Covered seating", price: 149, capacity: 60 },
      ],
      max: 8,
    },
    {
      owner: org,
      title: "Careers in Product: Alumni Fireside",
      summary: "Three alumni product leaders on breaking in, switching tracks and what they'd do differently.",
      description: "An informal fireside chat followed by small-group mentoring tables. Light refreshments provided.",
      category: "career",
      venue: "Seminar Hall 1",
      start: at(4, 17),
      hours: 2,
      tiers: [{ name: "RSVP", price: 0, capacity: 90 }],
      max: 2,
      passes: false,
    },
    {
      owner: org2,
      title: "Midnight Film Club: Restored Classics",
      summary: "A double bill of newly restored Satyajit Ray films, with chai at the interval.",
      description: "Our late-night screening series returns with two restored classics on the big screen.",
      category: "social",
      venue: "Auditorium B",
      start: at(2, 21),
      hours: 4,
      tiers: [{ name: "Screening", price: 99, capacity: 6 }],
      max: 2,
    },
    {
      owner: org,
      title: "Faculty Senate Briefing (Invite only)",
      summary: "Briefing on the new academic calendar — shared by direct link with department heads.",
      description: "This session is unlisted and shared by direct link only.",
      category: "academic",
      venue: "Senate Room",
      start: at(6, 11),
      hours: 1,
      tiers: [{ name: "Attendee", price: 0, capacity: 30 }],
      visibility: "unlisted",
      eligible: ["faculty", "staff"],
    },
    {
      owner: org,
      title: "Robotics Society Showcase (Draft)",
      summary: "End-of-semester showcase of student-built robots.",
      description: "Still being planned.",
      category: "technical",
      venue: "Mechanical Workshop",
      start: at(20, 15),
      hours: 3,
      tiers: [{ name: "Visitor", price: 0, capacity: 150 }],
      status: "draft",
    },
  ];

  const created: Record<string, { id: string; tiers: { id: string; name: string }[] }> = {};
  for (const s of seeds) {
    const startAt = s.start;
    const endAt = new Date(startAt.getTime() + s.hours * hour);
    const [ev] = await db
      .insert(events)
      .values({
        slug: slugify(s.title),
        organizerId: s.owner.id,
        title: s.title,
        summary: s.summary,
        description: s.description,
        category: s.category,
        venue: s.venue,
        startAt,
        endAt,
        registrationClosesAt: new Date(startAt.getTime() - 2 * hour),
        checkinOpensAt: new Date(startAt.getTime() - hour),
        checkinClosesAt: new Date(endAt.getTime()),
        visibility: s.visibility ?? "public",
        status: s.status ?? "published",
        publishedAt: (s.status ?? "published") === "published" ? new Date() : null,
        maxTicketsPerBooking: s.max ?? 4,
        allowPassRequests: s.passes ?? false,
        ...(s.eligible ? { eligibleCategories: s.eligible } : {}),
      })
      .returning();
    const tiers = await db
      .insert(ticketTiers)
      .values(
        s.tiers.map((t, i) => ({
          eventId: ev!.id,
          name: t.name,
          description: t.description ?? "",
          pricePaise: t.price * 100,
          capacity: t.capacity,
          sortOrder: i,
        })),
      )
      .returning();
    created[s.title] = { id: ev!.id, tiers };
  }

  // A live event today for scanner demos: check-in window open now.
  const liveStart = new Date(Date.now() + 2 * hour);
  const [live] = await db
    .insert(events)
    .values({
      slug: slugify("Orientation Mixer"),
      organizerId: org.id,
      title: "Orientation Mixer for New Students",
      summary: "Meet your batch, find your clubs, and grab free food. Check-in is open now.",
      description: "A relaxed evening for first-years and transfer students. Club stalls, games and dinner.",
      category: "social",
      venue: "Student Union Courtyard",
      startAt: liveStart,
      endAt: new Date(liveStart.getTime() + 3 * hour),
      registrationClosesAt: new Date(liveStart.getTime() + hour),
      checkinOpensAt: new Date(Date.now() - hour),
      checkinClosesAt: new Date(liveStart.getTime() + 3 * hour),
      status: "published",
      publishedAt: new Date(),
      maxTicketsPerBooking: 3,
    })
    .returning();
  const [liveTier] = await db.insert(ticketTiers).values({ eventId: live!.id, name: "Entry", pricePaise: 0, capacity: 250 }).returning();

  const k = () => randomUUID();
  const hack = created["HackNorth 2026: 24-Hour Build Sprint"]!;
  const raag = created["Raag & Rhythm — An Evening of Indian Classical Fusion"]!;
  const ml = created["Applied Machine Learning Workshop"]!;
  const film = created["Midnight Film Club: Restored Classics"]!;
  const football = created["Inter-College Football Cup — Finals"]!;

  async function paid(user: Profile, eventId: string, tierId: string, qty: number, names: string[] = []) {
    const b = await createBooking(user, { eventId, lines: [{ tierId, quantity: qty }], attendeeNames: names, idempotencyKey: k() });
    const o = await createOrderForBooking(user, b.id);
    await confirmPayment({ orderId: o.orderId, paymentId: `pay_mock_${k().slice(0, 12)}`, via: "mock" });
    return b;
  }

  // Riya: approved paid booking with two attendees, plus a free approved registration.
  const r1 = await paid(p1, raag.id, raag.tiers[1]!.id, 2, ["Riya Sharma", "Ananya Sharma"]);
  await decideBooking(org2, r1.id, "approve");
  const r2 = await createBooking(p1, { eventId: ml.id, lines: [{ tierId: ml.tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: k() });
  await decideBooking(org, r2.id, "approve");
  const r3 = await createBooking(p1, { eventId: live!.id, lines: [{ tierId: liveTier!.id, quantity: 2 }], attendeeNames: ["Riya Sharma", "Kabir Singh"], idempotencyKey: k() });
  await decideBooking(org, r3.id, "approve");

  // Daniel: paid and awaiting organizer verification; plus a pass request.
  await paid(p2, hack.id, hack.tiers[0]!.id, 1);
  await createBooking(p2, {
    eventId: hack.id,
    lines: [{ tierId: hack.tiers[1]!.id, quantity: 1 }],
    attendeeNames: [],
    idempotencyKey: k(),
    complimentary: { reason: "I'm mentoring the accessibility track on behalf of St. Joseph's College." },
  }).catch(() => undefined);

  // Aditi: holds a reservation awaiting payment, and a paid football booking awaiting verification.
  await createBooking(p3, { eventId: film.id, lines: [{ tierId: film.tiers[0]!.id, quantity: 2 }], attendeeNames: [], idempotencyKey: k() });
  await paid(p3, football.id, football.tiers[1]!.id, 3, ["Aditi Nair", "Meghna Nair", "Ishaan Rao"]);

  // A few more approved bookings so dashboards have shape.
  for (const [i, user] of [p2, p3].entries()) {
    const b = await paid(user, raag.id, raag.tiers[0]!.id, 1 + i);
    await decideBooking(org2, b.id, "approve");
  }

  // Pending cancellation request for the admin queue.
  await requestCancellation(org, created["Careers in Product: Alumni Fireside"]!.id, "Two of the three alumni speakers can no longer travel on this date. We'd like to cancel and reschedule next month.");

  console.log("✓ Demo data created. Demo accounts (password = SEED_DEMO_PASSWORD):");
  console.log("  admin@eventdeck.test · organizer@eventdeck.test · cultural@eventdeck.test");
  console.log("  participant@eventdeck.test · guest@eventdeck.test · aditi@eventdeck.test · applicant@eventdeck.test");
  void admin;
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
