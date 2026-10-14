import "server-only";
import type { DbOrTx } from "@/db";
import { auditLogs, notifications, profiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const REDACT = /(password|secret|token|signature|authorization|card|cvv)/i;

function scrub(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details).map(([k, v]) => [k, REDACT.test(k) ? "[redacted]" : v]),
  );
}

export async function audit(
  tx: DbOrTx,
  entry: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    eventId?: string | null;
    details?: Record<string, unknown>;
  },
) {
  await tx.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    eventId: entry.eventId ?? null,
    details: scrub(entry.details ?? {}),
  });
}

export type NotificationInput = { userId: string; type: string; title: string; body?: string; href?: string };

export async function notify(tx: DbOrTx, items: NotificationInput | NotificationInput[]) {
  const list = Array.isArray(items) ? items : [items];
  if (list.length === 0) return;
  await tx.insert(notifications).values(list.map((n) => ({ ...n, body: n.body ?? "" })));
}

export async function notifyAdmins(tx: DbOrTx, n: Omit<NotificationInput, "userId">) {
  const admins = await tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.role, "admin"), eq(profiles.isActive, true)));
  await notify(tx, admins.map((a) => ({ ...n, userId: a.id })));
}
