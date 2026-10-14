import type { Campus, Event, InstitutionType, ParticipantCategory, Profile } from "@/db/schema";

export const ALL_INSTITUTION_TYPES: InstitutionType[] = ["SRM", "EXTERNAL_INSTITUTION", "GUEST"];
export const ALL_CAMPUSES: Campus[] = ["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"];

const CAMPUS_SHORT: Record<Campus, string> = { KTR: "KTR", RAMAPURAM: "Ramapuram", VADAPALANI: "Vadapalani", OTHER_SRM: "other SRM campuses" };

type Audience = Pick<Event, "eligibleCategories" | "eligibleInstitutionTypes" | "eligibleCampuses" | "eligibleInstitutions">;
type Viewer = Pick<Profile, "category" | "institutionType" | "campus" | "institutionName">;

/** Case/space/punctuation-insensitive institution key ("Anna  University." → "anna university"). */
export function normaliseInstitution(name: string | null | undefined) {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseInstitutionList(raw: string) {
  const seen = new Set<string>();
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 0)
    .filter((s) => {
      const k = normaliseInstitution(s);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export type EligibilityResult = { ok: true } | { ok: false; reason: string };

/**
 * Server-authoritative audience check. Uses only the stored profile —
 * never values sent by the client — so request tampering cannot widen access.
 */
export function checkEligibility(event: Audience, user: Viewer): EligibilityResult {
  if (!event.eligibleInstitutionTypes.includes(user.institutionType)) {
    const who = user.institutionType === "SRM" ? "SRM members" : user.institutionType === "GUEST" ? "guests" : "students from other colleges";
    return { ok: false, reason: `This event isn't open to ${who}.` };
  }
  if (user.institutionType === "SRM") {
    if (!user.campus || !event.eligibleCampuses.includes(user.campus)) {
      return { ok: false, reason: `This event is limited to ${campusList(event.eligibleCampuses)}.` };
    }
  }
  if (user.institutionType === "EXTERNAL_INSTITUTION" && event.eligibleInstitutions.length > 0) {
    const mine = normaliseInstitution(user.institutionName);
    if (!mine || !event.eligibleInstitutions.some((i) => normaliseInstitution(i) === mine)) {
      return { ok: false, reason: `Only approved institutions can register: ${event.eligibleInstitutions.join(", ")}.` };
    }
  }
  if (!event.eligibleCategories.includes(user.category as ParticipantCategory)) {
    return { ok: false, reason: "Your participant category isn't eligible for this event." };
  }
  return { ok: true };
}

function campusList(campuses: Campus[]) {
  if (ALL_CAMPUSES.every((c) => campuses.includes(c))) return "SRM members";
  return `SRM ${campuses.map((c) => CAMPUS_SHORT[c]).join(", ").replace(/, ([^,]*)$/, " & $1")}`;
}

/** Short human label for cards and detail pages. */
export function describeAudience(event: Pick<Audience, "eligibleInstitutionTypes" | "eligibleCampuses" | "eligibleInstitutions">) {
  const types = event.eligibleInstitutionTypes;
  const srm = types.includes("SRM");
  const ext = types.includes("EXTERNAL_INSTITUTION");
  const guest = types.includes("GUEST");
  const allCampuses = ALL_CAMPUSES.every((c) => event.eligibleCampuses.includes(c));
  const anyCollege = event.eligibleInstitutions.length === 0;

  if (srm && ext && guest && allCampuses && anyCollege) return { label: "Open to all", scope: "open" as const };
  const srmPart = srm ? (allCampuses ? "All SRM campuses" : campusList(event.eligibleCampuses)) : null;
  if (srm && !ext && !guest) {
    return { label: allCampuses ? "SRM only · inter-campus" : event.eligibleCampuses.length === 1 ? `${srmPart} only` : `${srmPart} · inter-campus`, scope: "srm" as const };
  }
  const parts = [
    srmPart,
    ext ? (anyCollege ? "other colleges" : event.eligibleInstitutions.join(", ")) : null,
    guest ? "guests" : null,
  ].filter(Boolean) as string[];
  const label = parts.join(" + ");
  return { label: label.charAt(0).toUpperCase() + label.slice(1), scope: ext ? ("intercollege" as const) : ("restricted" as const) };
}
