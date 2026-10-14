import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { profiles, type Profile, type Role } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403 = 401,
  ) {
    super(message);
  }
}

/** The signed-in user's profile, verified against Supabase Auth. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  if (!profile || !profile.isActive) return null;
  return profile;
});

/** For pages: redirect to login (or home) when the user lacks access. */
export async function requirePageUser(roles?: Role[], next?: string): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (roles && !roles.includes(user.role)) redirect("/forbidden");
  return user;
}

/** For server actions and route handlers: throw on missing access. */
export async function requireUser(roles?: Role[]): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in to continue.", 401);
  if (roles && !roles.includes(user.role)) throw new AuthError("You don't have permission to do that.", 403);
  return user;
}

export function homeFor(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "organizer") return "/organizer";
  return "/my/bookings";
}
