"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { refunds } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { resolveException } from "@/lib/server/bookings";
import { approveCancellation, processRefund, rejectCancellation } from "@/lib/server/cancellations";
import { DomainError, toActionError, type ActionResult } from "@/lib/server/errors";
import { reviewApplication, setUserActive, setUserRole } from "@/lib/server/users";

const uuid = z.string().uuid();
const check = (id: string) => {
  if (!uuid.safeParse(id).success) throw new DomainError("Not found.", "not_found");
};

export async function reviewApplicationAction(id: string, approve: boolean, note?: string): Promise<ActionResult> {
  try {
    const admin = await requireUser(["admin"]);
    check(id);
    await reviewApplication(admin, id, approve, note);
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { ok: true, message: approve ? "Organizer approved." : "Application declined." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setUserRoleAction(userId: string, role: "participant" | "organizer"): Promise<ActionResult> {
  try {
    const admin = await requireUser(["admin"]);
    check(userId);
    if (role !== "participant" && role !== "organizer") throw new DomainError("Invalid role.");
    await setUserRole(admin, userId, role);
    revalidatePath("/admin/users");
    return { ok: true, message: role === "organizer" ? "Organizer access granted." : "Organizer access removed." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  try {
    const admin = await requireUser(["admin"]);
    check(userId);
    await setUserActive(admin, userId, active);
    revalidatePath("/admin/users");
    return { ok: true, message: active ? "Account reactivated." : "Account deactivated and signed out." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function approveCancellationAction(requestId: string, note?: string): Promise<ActionResult> {
  try {
    const admin = await requireUser(["admin"]);
    check(requestId);
    const r = await approveCancellation(admin, { requestId, note });
    revalidatePath("/admin", "layout");
    revalidatePath("/events");
    return { ok: true, message: `Event cancelled. ${r.affected} booking(s) affected, ${r.refunds} refund(s) queued.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function rejectCancellationAction(requestId: string, note = ""): Promise<ActionResult> {
  try {
    const admin = await requireUser(["admin"]);
    check(requestId);
    if (note.trim().length < 5) return { ok: false, error: "Add a short note for the organizer." };
    await rejectCancellation(admin, requestId, note);
    revalidatePath("/admin/cancellations");
    return { ok: true, message: "Request declined. The event stays live." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function adminCancelEventAction(eventId: string, reason: string): Promise<ActionResult> {
  try {
    const admin = await requireUser(["admin"]);
    check(eventId);
    if (reason.trim().length < 15) return { ok: false, error: "Please explain the reason (15+ characters)." };
    const r = await approveCancellation(admin, { eventId, reason });
    revalidatePath("/", "layout");
    return { ok: true, message: `Event cancelled. ${r.affected} booking(s) affected, ${r.refunds} refund(s) queued.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function processRefundAction(refundId: string): Promise<ActionResult> {
  try {
    const admin = await requireUser(["admin"]);
    check(refundId);
    const r = await processRefund(admin, refundId);
    revalidatePath("/admin/refunds");
    revalidatePath("/admin");
    if (r.status === "failed") return { ok: false, error: `Refund failed: ${r.failureReason ?? "unknown error"}. You can retry.` };
    return { ok: true, message: r.status === "processed" ? "Refund processed (test mode)." : "Refund submitted — awaiting Razorpay confirmation." };
  } catch (err) {
    const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
    if (code === "55P03") return { ok: false, error: "This refund is already being processed." };
    return toActionError(err);
  }
}

export async function processAllRefundsAction(): Promise<ActionResult> {
  try {
    const admin = await requireUser(["admin"]);
    const pending = await db.select({ id: refunds.id }).from(refunds).where(inArray(refunds.status, ["pending", "failed"])).limit(100);
    let ok = 0;
    let failed = 0;
    for (const r of pending) {
      try {
        const res = await processRefund(admin, r.id);
        if (res.status === "failed") failed++;
        else ok++;
      } catch {
        failed++;
      }
    }
    revalidatePath("/admin/refunds");
    revalidatePath("/admin");
    return failed ? { ok: false, error: `${ok} processed, ${failed} failed. Retry the failed ones individually.` } : { ok: true, message: `${ok} refund(s) processed.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function resolveExceptionAction(bookingId: string, note = ""): Promise<ActionResult> {
  try {
    const admin = await requireUser(["admin"]);
    check(bookingId);
    if (note.trim().length < 5) return { ok: false, error: "Describe how this was resolved." };
    await resolveException(admin, bookingId, note);
    revalidatePath("/admin/exceptions");
    revalidatePath("/admin");
    return { ok: true, message: "Exception marked resolved." };
  } catch (err) {
    return toActionError(err);
  }
}
