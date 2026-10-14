import type { Role } from "@/db/schema";

/** Landing page for each platform role. Pure: safe to import anywhere, including unit tests. */
export function homeFor(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "organizer") return "/organizer";
  return "/my/bookings";
}
