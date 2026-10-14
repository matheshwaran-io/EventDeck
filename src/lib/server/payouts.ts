import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  events,
  organizerPayoutAccounts,
  payouts,
  profiles,
  type OrganizerPayoutAccount,
  type Payout,
  type Profile,
} from "@/db/schema";
import { randomCode } from "@/lib/domain/tokens";
import { formatPaise } from "@/lib/format";
import {
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_RATE,
  type PayoutAccountInput,
  type ProcessPayoutInput,
  type RequestPayoutInput,
} from "@/lib/validation/payouts";
import { audit, notify, notifyAdmins } from "./audit";
import { DomainError } from "./errors";

export { PLATFORM_FEE_PERCENT, PLATFORM_FEE_RATE };

export const payoutReference = () => `PO-${randomCode(8)}`;

export async function getOrganizerPayoutProfile(userId: string): Promise<OrganizerPayoutAccount | null> {
  const [acc] = await db
    .select()
    .from(organizerPayoutAccounts)
    .where(eq(organizerPayoutAccounts.userId, userId))
    .limit(1);
  return acc ?? null;
}

export async function saveOrganizerPayoutAccount(
  actor: Profile,
  input: PayoutAccountInput,
): Promise<OrganizerPayoutAccount> {
  return db.transaction(async (tx) => {
    // Simulated instant verification for Test Mode / Sandbox
    const note =
      input.accountType === "bank_account"
        ? `Verified in Test Mode (Penny drop simulated for ${input.bankName || "Bank"})`
        : `Verified in Test Mode (VPA handle validated for ${input.upiId})`;

    const [account] = await tx
      .insert(organizerPayoutAccounts)
      .values({
        userId: actor.id,
        accountType: input.accountType,
        beneficiaryName: input.beneficiaryName,
        bankName: input.accountType === "bank_account" ? input.bankName || null : null,
        accountNumber: input.accountType === "bank_account" ? input.accountNumber || null : null,
        ifscCode: input.accountType === "bank_account" ? input.ifscCode || null : null,
        upiId: input.accountType === "upi" ? input.upiId || null : null,
        status: "verified",
        verificationNote: note,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: organizerPayoutAccounts.userId,
        set: {
          accountType: input.accountType,
          beneficiaryName: input.beneficiaryName,
          bankName: input.accountType === "bank_account" ? input.bankName || null : null,
          accountNumber: input.accountType === "bank_account" ? input.accountNumber || null : null,
          ifscCode: input.accountType === "bank_account" ? input.ifscCode || null : null,
          upiId: input.accountType === "upi" ? input.upiId || null : null,
          status: "verified",
          verificationNote: note,
          updatedAt: new Date(),
        },
      })
      .returning();

    await audit(tx, {
      actorId: actor.id,
      action: "payout_account.updated",
      entityType: "organizer_payout_account",
      entityId: account!.id,
      details: {
        accountType: input.accountType,
        beneficiaryName: input.beneficiaryName,
        method: input.accountType,
      },
    });

    return account!;
  });
}

export type OrganizerEventFinancial = {
  id: string;
  title: string;
  venue: string;
  startAt: Date;
  endAt: Date;
  status: string;
  grossPaise: number;
  feePaise: number;
  netPaise: number;
  disbursedPaise: number;
  pendingPaise: number;
  availablePaise: number;
  paidBookingsCount: number;
};

export type OrganizerPayoutsData = {
  account: OrganizerPayoutAccount | null;
  metrics: {
    totalGrossPaise: number;
    totalFeePaise: number;
    totalDisbursedPaise: number;
    totalPendingPaise: number;
    availablePaise: number;
  };
  events: OrganizerEventFinancial[];
  history: (Payout & { eventTitle: string })[];
};

export async function getOrganizerPayoutsData(userId: string): Promise<OrganizerPayoutsData> {
  const account = await getOrganizerPayoutProfile(userId);

  // Fetch organizer's events
  const userEvents = await db
    .select()
    .from(events)
    .where(eq(events.organizerId, userId))
    .orderBy(desc(events.createdAt));

  if (userEvents.length === 0) {
    return {
      account,
      metrics: {
        totalGrossPaise: 0,
        totalFeePaise: 0,
        totalDisbursedPaise: 0,
        totalPendingPaise: 0,
        availablePaise: 0,
      },
      events: [],
      history: [],
    };
  }

  const eventIds = userEvents.map((e) => e.id);

  // Get total gross collected per event from paid bookings
  const paidRows = await db
    .select({
      eventId: bookings.eventId,
      count: sql<number>`count(*)::int`,
      grossPaise: sql<number>`coalesce(sum(${bookings.amountPaise}), 0)::int`,
    })
    .from(bookings)
    .where(and(inArray(bookings.eventId, eventIds), eq(bookings.paymentStatus, "paid")))
    .groupBy(bookings.eventId);

  const grossMap = new Map<string, { count: number; gross: number }>();
  for (const r of paidRows) {
    grossMap.set(r.eventId, { count: r.count, gross: r.grossPaise });
  }

  // Get all payouts for these events
  const payoutRows = await db
    .select({
      payout: payouts,
      eventTitle: events.title,
    })
    .from(payouts)
    .innerJoin(events, eq(events.id, payouts.eventId))
    .where(inArray(payouts.eventId, eventIds))
    .orderBy(desc(payouts.createdAt));

  const eventFinancials: OrganizerEventFinancial[] = [];
  let totalGross = 0;
  let totalFee = 0;
  let totalDisbursed = 0;
  let totalPending = 0;

  for (const e of userEvents) {
    const data = grossMap.get(e.id) ?? { count: 0, gross: 0 };
    const gross = data.gross;
    const fee = Math.round(gross * PLATFORM_FEE_RATE);
    const net = gross - fee;

    // Filter payouts for this specific event
    const eventPayouts = payoutRows.filter((p) => p.payout.eventId === e.id);
    const allocatedGross = eventPayouts
      .filter((p) => p.payout.status === "requested" || p.payout.status === "processing" || p.payout.status === "completed")
      .reduce((sum, p) => sum + p.payout.amountPaise, 0);
    const disbursed = eventPayouts
      .filter((p) => p.payout.status === "completed")
      .reduce((sum, p) => sum + p.payout.netAmountPaise, 0);
    const pending = eventPayouts
      .filter((p) => p.payout.status === "requested" || p.payout.status === "processing")
      .reduce((sum, p) => sum + p.payout.netAmountPaise, 0);

    const available = Math.max(0, gross - allocatedGross);

    totalGross += gross;
    totalFee += fee;
    totalDisbursed += disbursed;
    totalPending += pending;

    eventFinancials.push({
      id: e.id,
      title: e.title,
      venue: e.venue,
      startAt: e.startAt,
      endAt: e.endAt,
      status: e.status,
      grossPaise: gross,
      feePaise: fee,
      netPaise: net,
      disbursedPaise: disbursed,
      pendingPaise: pending,
      availablePaise: available,
      paidBookingsCount: data.count,
    });
  }

  const availablePaise = Math.max(0, totalGross - totalFee - totalDisbursed - totalPending);

  return {
    account,
    metrics: {
      totalGrossPaise: totalGross,
      totalFeePaise: totalFee,
      totalDisbursedPaise: totalDisbursed,
      totalPendingPaise: totalPending,
      availablePaise,
    },
    events: eventFinancials,
    history: payoutRows.map((r) => ({ ...r.payout, eventTitle: r.eventTitle })),
  };
}

export async function requestPayout(
  actor: Profile,
  input: RequestPayoutInput,
): Promise<Payout> {
  return db.transaction(async (tx) => {
    // 1. Verify organizer owns the event
    const [event] = await tx
      .select()
      .from(events)
      .where(and(eq(events.id, input.eventId), eq(events.organizerId, actor.id)))
      .limit(1);
    if (!event) throw new DomainError("Event not found or unauthorized.", "forbidden");

    // 2. Verify organizer has a registered payout account
    const [account] = await tx
      .select()
      .from(organizerPayoutAccounts)
      .where(eq(organizerPayoutAccounts.userId, actor.id))
      .limit(1);
    if (!account) {
      throw new DomainError("Please add and save your Bank or UPI payout account first.", "invalid");
    }

    // 3. Calculate event's available balance
    const [sales] = await tx
      .select({
        grossPaise: sql<number>`coalesce(sum(${bookings.amountPaise}), 0)::int`,
      })
      .from(bookings)
      .where(and(eq(bookings.eventId, event.id), eq(bookings.paymentStatus, "paid")));

    const gross = sales?.grossPaise ?? 0;

    const existingPayouts = await tx
      .select()
      .from(payouts)
      .where(
        and(
          eq(payouts.eventId, event.id),
          inArray(payouts.status, ["requested", "processing", "completed"]),
        ),
      );

    const alreadyAllocatedGross = existingPayouts.reduce((sum, p) => sum + p.amountPaise, 0);
    const available = Math.max(0, gross - alreadyAllocatedGross);

    const requestedPaise = Math.round(input.amountRupees * 100);
    if (requestedPaise <= 0) throw new DomainError("Invalid amount.", "invalid");
    if (requestedPaise > available) {
      throw new DomainError(
        `Requested amount (${formatPaise(requestedPaise)}) exceeds available event balance (${formatPaise(available)}).`,
        "invalid",
      );
    }

    // Calculate platform fee and net payout
    const platformFeePaise = Math.round(requestedPaise * PLATFORM_FEE_RATE);
    const netAmountPaise = requestedPaise - platformFeePaise;

    const ref = payoutReference();
    const beneficiarySnapshot = {
      beneficiaryName: account.beneficiaryName,
      accountType: account.accountType,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      ifscCode: account.ifscCode,
      upiId: account.upiId,
    };

    const [payout] = await tx
      .insert(payouts)
      .values({
        reference: ref,
        eventId: event.id,
        organizerId: actor.id,
        amountPaise: requestedPaise,
        platformFeePaise,
        netAmountPaise,
        status: "requested",
        payoutMethod: account.accountType === "upi" ? "upi" : "bank_transfer",
        beneficiarySnapshot,
        notes: input.notes || null,
      })
      .returning();

    await audit(tx, {
      actorId: actor.id,
      action: "payout.requested",
      entityType: "payout",
      entityId: payout!.id,
      eventId: event.id,
      details: {
        reference: ref,
        amountPaise: requestedPaise,
        netAmountPaise,
        method: account.accountType,
      },
    });

    await notifyAdmins(tx, {
      type: "payout.requested",
      title: `Payout requested: ${formatPaise(netAmountPaise)}`,
      body: `${actor.fullName} requested settlement for "${event.title}".`,
      href: "/admin/payouts",
    });

    return payout!;
  });
}

export type AdminPayoutRow = Payout & {
  eventTitle: string;
  organizerName: string;
  organizerEmail: string;
  processedByName: string | null;
};

export type AdminPayoutsOverview = {
  metrics: {
    totalRevenuePaise: number;
    totalPlatformFeesPaise: number;
    pendingPayoutsPaise: number;
    pendingCount: number;
    disbursedPayoutsPaise: number;
    disbursedCount: number;
  };
  payouts: AdminPayoutRow[];
};

export async function getAdminPayoutsOverview(): Promise<AdminPayoutsOverview> {
  // Platform overall ticket sales
  const [sales] = await db
    .select({
      totalRevenuePaise: sql<number>`coalesce(sum(${bookings.amountPaise}), 0)::int`,
    })
    .from(bookings)
    .where(eq(bookings.paymentStatus, "paid"));

  const totalRev = sales?.totalRevenuePaise ?? 0;
  const platformFees = Math.round(totalRev * PLATFORM_FEE_RATE);

  // All payouts with event, organizer, and processor profile
  const rows = await db
    .select({
      payout: payouts,
      eventTitle: events.title,
      organizerName: profiles.fullName,
      organizerEmail: profiles.email,
    })
    .from(payouts)
    .innerJoin(events, eq(events.id, payouts.eventId))
    .innerJoin(profiles, eq(profiles.id, payouts.organizerId))
    .orderBy(desc(payouts.createdAt));

  // Get processor names
  const processorIds = Array.from(new Set(rows.map((r) => r.payout.processedBy).filter(Boolean))) as string[];
  const processorMap = new Map<string, string>();
  if (processorIds.length > 0) {
    const procs = await db
      .select({ id: profiles.id, name: profiles.fullName })
      .from(profiles)
      .where(inArray(profiles.id, processorIds));
    for (const p of procs) processorMap.set(p.id, p.name);
  }

  let pendingPaise = 0;
  let pendingCount = 0;
  let disbursedPaise = 0;
  let disbursedCount = 0;

  const resultList: AdminPayoutRow[] = rows.map((r) => {
    if (r.payout.status === "requested" || r.payout.status === "processing") {
      pendingPaise += r.payout.netAmountPaise;
      pendingCount++;
    } else if (r.payout.status === "completed") {
      disbursedPaise += r.payout.netAmountPaise;
      disbursedCount++;
    }
    return {
      ...r.payout,
      eventTitle: r.eventTitle,
      organizerName: r.organizerName,
      organizerEmail: r.organizerEmail,
      processedByName: r.payout.processedBy ? processorMap.get(r.payout.processedBy) ?? null : null,
    };
  });

  return {
    metrics: {
      totalRevenuePaise: totalRev,
      totalPlatformFeesPaise: platformFees,
      pendingPayoutsPaise: pendingPaise,
      pendingCount,
      disbursedPayoutsPaise: disbursedPaise,
      disbursedCount,
    },
    payouts: resultList,
  };
}

export async function processPayout(
  admin: Profile,
  input: ProcessPayoutInput,
): Promise<Payout> {
  return db.transaction(async (tx) => {
    const [payout] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.id, input.payoutId))
      .for("update");

    if (!payout) throw new DomainError("Payout request not found.", "not_found");
    if (payout.status !== "requested" && payout.status !== "processing") {
      throw new DomainError("This payout request has already been finalized.", "conflict");
    }

    const [event] = await tx.select().from(events).where(eq(events.id, payout.eventId)).limit(1);

    if (input.action === "approve") {
      // Generate a realistic bank UTR or simulated transfer reference if not manually provided
      const utr =
        input.utr?.trim() ||
        `CMS${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 899 + 100)}`;

      const [updated] = await tx
        .update(payouts)
        .set({
          status: "completed",
          utr,
          notes: input.notes?.trim() || null,
          processedBy: admin.id,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payouts.id, payout.id))
        .returning();

      await audit(tx, {
        actorId: admin.id,
        action: "payout.disbursed",
        entityType: "payout",
        entityId: payout.id,
        eventId: payout.eventId,
        details: {
          reference: payout.reference,
          netAmountPaise: payout.netAmountPaise,
          utr,
          notes: input.notes,
        },
      });

      await notify(tx, {
        userId: payout.organizerId,
        type: "payout.completed",
        title: `Payout disbursed: ${formatPaise(payout.netAmountPaise)}`,
        body: `Settlement for "${event?.title ?? "your event"}" transferred via ${payout.payoutMethod === "upi" ? "UPI" : "Bank Transfer"} (Ref/UTR: ${utr}).`,
        href: "/organizer/payouts",
      });

      return updated!;
    } else {
      // Reject
      const [updated] = await tx
        .update(payouts)
        .set({
          status: "rejected",
          notes: input.notes?.trim() || "Declined by administrator.",
          processedBy: admin.id,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payouts.id, payout.id))
        .returning();

      await audit(tx, {
        actorId: admin.id,
        action: "payout.rejected",
        entityType: "payout",
        entityId: payout.id,
        eventId: payout.eventId,
        details: {
          reference: payout.reference,
          reason: input.notes,
        },
      });

      await notify(tx, {
        userId: payout.organizerId,
        type: "payout.rejected",
        title: `Payout request declined`,
        body: `Payout request ${payout.reference} was declined. Note: ${input.notes || "Contact the platform administrator."}`,
        href: "/organizer/payouts",
      });

      return updated!;
    }
  });
}
