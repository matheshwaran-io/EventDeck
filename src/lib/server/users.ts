import "server-only";
import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { organizerApplications, profiles, type Profile, type Role } from "@/db/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { audit, notify, notifyAdmins } from "./audit";
import { DomainError, pgErrorCode } from "./errors";
import { isSrmEmail, isRootAdmin } from "@/lib/constants";

export async function updateOwnProfile(
  user: Profile,
  input: {
    fullName: string;
    phone?: string | null;
    institutionType?: Profile["institutionType"];
    campus?: Profile["campus"];
    affiliation?: Profile["affiliation"];
    institutionName?: string | null;
    city?: string | null;
    department?: string | null;
    category?: Profile["category"];
    institution?: string | null;
  },
) {
  // Only descriptive fields — role and is_active are never accepted from the client.
  const instType = input.institutionType ?? user.institutionType ?? "SRM";
  const camp = instType === "SRM" ? (input.campus ?? user.campus ?? "KTR") : null;
  const affil = input.affiliation ?? user.affiliation ?? "STUDENT";
  // QA-002: SRM students/staff must hold an official SRM email — same rule as signup.
  if (instType === "SRM" && (affil === "STUDENT" || affil === "STAFF") && !isSrmEmail(user.email)) {
    throw new DomainError(
      "SRM students and staff need an official SRM email (@srmist.edu.in). Ask an administrator to update your account email, or choose your actual institution.",
      "forbidden",
    );
  }
  const instName = instType === "SRM" ? "SRM University" : (input.institutionName ?? user.institutionName ?? null);
  const city = instType === "EXTERNAL_INSTITUTION" ? (input.city ?? user.city ?? null) : null;
  const dept = input.department ?? user.department ?? null;

  let cat: Profile["category"] = input.category ?? user.category;
  let instStr: string | null = input.institution ?? user.institution;

  if (instType === "GUEST" || affil === "GUEST") {
    cat = "guest";
    instStr = "Guest";
  } else if (instType === "SRM") {
    if (affil === "STUDENT") cat = "host_student";
    else if (affil === "FACULTY") cat = "faculty";
    else if (affil === "STAFF") cat = "staff";
    else if (affil === "ALUMNI") cat = "alumni";
    instStr = dept ? `SRM ${camp} — ${dept}` : `SRM ${camp} Campus`;
  } else {
    if (affil === "FACULTY") cat = "faculty";
    else if (affil === "STAFF") cat = "staff";
    else cat = "external_student";
    instStr = `${instName || "External Institution"}${city ? ` (${city})` : ""}`;
  }

  const [row] = await db
    .update(profiles)
    .set({
      fullName: input.fullName,
      phone: input.phone || null,
      institutionType: instType,
      campus: camp,
      affiliation: affil,
      institutionName: instName,
      city: city,
      department: dept,
      category: cat,
      institution: instStr,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id))
    .returning();
  return row!;
}

export async function applyForOrganizer(user: Profile, input: { organization: string; reason: string }) {
  if (user.role !== "participant") throw new DomainError("Your account already has organizer access.", "conflict");
  try {
    return await db.transaction(async (tx) => {
      const [app] = await tx
        .insert(organizerApplications)
        .values({ userId: user.id, organization: input.organization, reason: input.reason })
        .returning();
      await audit(tx, {
        actorId: user.id,
        action: "organizer.applied",
        entityType: "organizer_application",
        entityId: app!.id,
        details: { organization: input.organization },
      });
      await notifyAdmins(tx, {
        type: "organizer.applied",
        title: "Organizer application",
        body: `${user.fullName} · ${input.organization}`,
        href: "/admin/users?tab=applications",
      });
      return app!;
    });
  } catch (err) {
    if (pgErrorCode(err).constraint === "organizer_applications_one_pending") {
      throw new DomainError("You already have an application under review.", "conflict");
    }
    throw err;
  }
}

export async function reviewApplication(admin: Profile, applicationId: string, approve: boolean, note?: string) {
  return db.transaction(async (tx) => {
    const [app] = await tx
      .update(organizerApplications)
      .set({
        status: approve ? "approved" : "rejected",
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        reviewNote: note?.trim().slice(0, 500) || null,
      })
      .where(and(eq(organizerApplications.id, applicationId), eq(organizerApplications.status, "pending")))
      .returning();
    if (!app) throw new DomainError("This application was already reviewed.", "conflict");
    if (approve) {
      await tx
        .update(profiles)
        .set({ role: "organizer", updatedAt: new Date() })
        .where(and(eq(profiles.id, app.userId), eq(profiles.role, "participant")));
    }
    await audit(tx, {
      actorId: admin.id,
      action: approve ? "organizer.approved" : "organizer.rejected",
      entityType: "profile",
      entityId: app.userId,
      details: { organization: app.organization, note: app.reviewNote },
    });
    await notify(tx, {
      userId: app.userId,
      type: approve ? "organizer.approved" : "organizer.rejected",
      title: approve ? "You're now an organizer" : "Organizer application declined",
      body: approve
        ? "You can create and publish events from your organizer dashboard."
        : app.reviewNote ?? "An administrator reviewed your application.",
      href: approve ? "/organizer" : "/my/profile",
    });
    return app;
  });
}

/** Admins may switch accounts between participant and organizer. Admin rights are provisioned out-of-band only. */
export async function setUserRole(admin: Profile, userId: string, role: Exclude<Role, "admin">) {
  if (userId === admin.id) throw new DomainError("You can't change your own role.", "forbidden");
  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!target) throw new DomainError("User not found.", "not_found");
    if (isRootAdmin(target.email)) throw new DomainError("Root administrator account is permanent and cannot be modified.", "forbidden");
    if (target.role === "admin") throw new DomainError("Administrator accounts can't be changed here.", "forbidden");
    if (target.role === role) return target;
    const [row] = await tx.update(profiles).set({ role, updatedAt: new Date() }).where(eq(profiles.id, userId)).returning();
    await audit(tx, {
      actorId: admin.id,
      action: "user.role_changed",
      entityType: "profile",
      entityId: userId,
      details: { from: target.role, to: role },
    });
    await notify(tx, {
      userId,
      type: "user.role_changed",
      title: role === "organizer" ? "Organizer access granted" : "Organizer access removed",
      body: role === "organizer" ? "You can now create and manage events." : "Your account is now a participant account.",
      href: role === "organizer" ? "/organizer" : "/my/bookings",
    });
    return row!;
  });
}

export async function setUserActive(admin: Profile, userId: string, active: boolean) {
  if (userId === admin.id) throw new DomainError("You can't deactivate your own account.", "forbidden");
  const row = await db.transaction(async (tx) => {
    const [target] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!target) throw new DomainError("User not found.", "not_found");
    if (isRootAdmin(target.email)) throw new DomainError("Root administrator account is permanent and cannot be deactivated or removed.", "forbidden");
    if (target.role === "admin") throw new DomainError("Administrator accounts can't be deactivated here.", "forbidden");
    const [row] = await tx.update(profiles).set({ isActive: active, updatedAt: new Date() }).where(eq(profiles.id, userId)).returning();
    await audit(tx, {
      actorId: admin.id,
      action: active ? "user.reactivated" : "user.deactivated",
      entityType: "profile",
      entityId: userId,
    });
    return row!;
  });
  // Also block / unblock sign-in at the auth layer.
  try {
    await createSupabaseAdminClient().auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  } catch (e) {
    console.warn("[users] auth ban update failed", e instanceof Error ? e.message : e);
  }
  return row;
}

export async function listUsers(params: { q?: string; role?: Role; page?: number }) {
  const pageSize = 25;
  const page = Math.max(1, params.page ?? 1);
  const conds: SQL[] = [];
  if (params.role) conds.push(eq(profiles.role, params.role));
  if (params.q) {
    const like = `%${params.q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(or(ilike(profiles.fullName, like), ilike(profiles.email, like), ilike(profiles.institution, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        profile: profiles,
        bookings: sql<number>`(select count(*) from bookings b where b.user_id = "profiles"."id")::int`,
        events: sql<number>`(select count(*) from events e where e.organizer_id = "profiles"."id")::int`,
      })
      .from(profiles)
      .where(where)
      .orderBy(desc(profiles.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(profiles).where(where),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listApplications(status: "pending" | "approved" | "rejected" = "pending") {
  return db
    .select({ app: organizerApplications, name: profiles.fullName, email: profiles.email, institution: profiles.institution })
    .from(organizerApplications)
    .innerJoin(profiles, eq(profiles.id, organizerApplications.userId))
    .where(eq(organizerApplications.status, status))
    .orderBy(desc(organizerApplications.createdAt))
    .limit(100);
}
