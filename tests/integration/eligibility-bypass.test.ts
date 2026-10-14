import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { DomainError } from "@/lib/server/errors";
import { updateOwnProfile } from "@/lib/server/users";
import { cleanup, makeClassifiedUser } from "./helpers";

/**
 * Regression tests for QA-001 / QA-002: SRM affiliation must not be obtainable
 * without an official SRM email, whichever path the request takes.
 */
const created: string[] = [];
afterAll(async () => {
  if (created.length) await db.execute(sql`delete from auth.users where id in ${created}`);
  await cleanup();
});

function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The attack is a direct Supabase Auth signup; either way the row lands in
 * auth.users and the same trigger classifies it. When the test project has
 * "Confirm email" ON, a real signUp would send mail, so we exercise the identical
 * trigger path with a direct auth.users insert instead (no email is sent).
 */
async function emailConfirmationEnabled() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
  });
  return !((await res.json()) as { mailer_autoconfirm?: boolean }).mailer_autoconfirm;
}

async function directSignup(email: string, data?: Record<string, unknown>) {
  let id: string;
  if (await emailConfirmationEnabled()) {
    id = randomUUID();
    await db.execute(sql`
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
      values (${id}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${email}, '',
              ${JSON.stringify(data ?? {})}::jsonb, '{}'::jsonb, now(), now())`);
  } else {
    const { data: res, error } = await anonClient().auth.signUp({ email, password: "Bypass-Attempt-123", options: data ? { data } : undefined });
    expect(error).toBeNull();
    id = res.user!.id;
  }
  created.push(id);
  const [p] = await db.select().from(profiles).where(eq(profiles.id, id));
  return p!;
}

describe("QA-001: direct Supabase Auth signup cannot claim SRM membership", () => {
  it("a non-SRM email claiming SRM student metadata is not classified as an SRM student", async () => {
    const p = await directSignup(`bypass+${randomUUID().slice(0, 8)}@example.com`, {
      full_name: "Mallory",
      institution_type: "SRM",
      campus: "KTR",
      affiliation: "STUDENT",
      category: "host_student",
      role: "admin",
    });
    expect(p.role).toBe("participant");
    expect(p.institutionType).not.toBe("SRM");
    expect(p.category).not.toBe("host_student");
  });

  it("a non-SRM email with no metadata does not default to SRM student", async () => {
    const p = await directSignup(`bypass+${randomUUID().slice(0, 8)}@example.com`);
    expect(p.institutionType).not.toBe("SRM");
    expect(p.category).not.toBe("host_student");
  });

  it("a genuine SRM email is still classified as an SRM student on its campus", async () => {
    const p = await directSignup(`student+${randomUUID().slice(0, 8)}@srmist.edu.in`, {
      full_name: "Real Student",
      institution_type: "SRM",
      campus: "RAMAPURAM",
      affiliation: "STUDENT",
    });
    expect(p).toMatchObject({ institutionType: "SRM", campus: "RAMAPURAM", category: "host_student" });
  });
});

describe("QA-002: profile edits cannot claim SRM membership without an SRM email", () => {
  it("an external participant cannot switch themselves to SRM student", async () => {
    const ext = await makeClassifiedUser({
      email: `ext+${randomUUID().slice(0, 8)}@vit.ac.in`,
      institutionType: "EXTERNAL_INSTITUTION",
      affiliation: "STUDENT",
      institutionName: "VIT",
      city: "Vellore",
    });
    await expect(
      updateOwnProfile(ext, { fullName: ext.fullName, institutionType: "SRM", campus: "KTR", affiliation: "STUDENT" }),
    ).rejects.toBeInstanceOf(DomainError);
    const [after] = await db.select().from(profiles).where(eq(profiles.id, ext.id));
    expect(after).toMatchObject({ institutionType: "EXTERNAL_INSTITUTION", category: "external_student" });
  });

  it("an SRM-email user can still move between SRM campuses", async () => {
    const srm = await makeClassifiedUser({
      email: `move+${randomUUID().slice(0, 8)}@srmist.edu.in`,
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "STUDENT",
    });
    const updated = await updateOwnProfile(srm, { fullName: srm.fullName, institutionType: "SRM", campus: "VADAPALANI", affiliation: "STUDENT" });
    expect(updated).toMatchObject({ institutionType: "SRM", campus: "VADAPALANI", category: "host_student" });
  });
});
