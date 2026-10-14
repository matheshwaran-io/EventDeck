import type { Role } from "@/db/schema";

export type NavLink = { href: string; label: string };

export function primaryLinks(role: Role | null): NavLink[] {
  const links: NavLink[] = [{ href: "/events", label: "Events" }];
  if (role === "participant" || role === "organizer") links.push({ href: "/my/bookings", label: "My tickets" });
  if (role === "organizer") links.push({ href: "/organizer", label: "Organizer" });
  if (role === "admin") links.push({ href: "/admin", label: "Admin" });
  return links;
}

export const roleLabel: Record<Role, string> = {
  participant: "Participant",
  organizer: "Organizer",
  admin: "Administrator",
};
