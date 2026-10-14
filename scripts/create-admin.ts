/**
 * Provision (or promote) the initial administrator. Run from a trusted machine:
 *
 *   ADMIN_EMAIL=you@university.edu ADMIN_NAME="Jane Doe" npm run admin:create
 *
 * If ADMIN_PASSWORD is not set, a strong random password is generated and
 * printed once to this terminal. Admin rights can never be obtained through
 * the web app itself.
 */
import "./_env";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { auditLogs, profiles } from "@/db/schema";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";
  if (!email) throw new Error("Set ADMIN_EMAIL");
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`Set SUPABASE_SECRET_KEY in ${process.env.ENV_FILE ?? ".env.local"} (Project Settings → API Keys → Secret keys)`);
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [existing] = await db.select().from(profiles).where(sql`lower(${profiles.email}) = ${email}`);
  let userId = existing?.id;
  let generated: string | null = null;

  if (!userId) {
    const password = process.env.ADMIN_PASSWORD || (generated = `${randomBytes(12).toString("base64url")}Aa1!`);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, category: "staff" },
    });
    if (error || !data.user) throw new Error(`Could not create user: ${error?.message}`);
    userId = data.user.id;
  }

  await db.update(profiles).set({ role: "admin", isActive: true, updatedAt: new Date() }).where(eq(profiles.id, userId));
  await db.insert(auditLogs).values({ actorId: null, action: "user.admin_provisioned", entityType: "profile", entityId: userId, details: { via: "cli" } });

  console.log(`✓ ${email} is an administrator.`);
  if (generated) console.log(`  Generated password (shown once — store it in a password manager): ${generated}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
