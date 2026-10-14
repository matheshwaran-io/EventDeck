"use server";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function fetchNotifications() {
  const user = await requireUser();
  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(12);
  const unread = items.filter((n) => !n.readAt).length;
  return {
    unread,
    items: items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null })),
  };
}

export async function markNotificationsRead(ids?: string[]) {
  const user = await requireUser();
  const parsed = z.array(z.string().uuid()).max(100).optional().safeParse(ids);
  if (!parsed.success) return { ok: false };
  const conds = [eq(notifications.userId, user.id), isNull(notifications.readAt)];
  if (parsed.data?.length) conds.push(inArray(notifications.id, parsed.data));
  await db.update(notifications).set({ readAt: new Date() }).where(and(...conds));
  revalidatePath("/my/notifications");
  return { ok: true };
}
