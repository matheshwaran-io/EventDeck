import type { Metadata } from "next";
import Link from "next/link";
import { Check, Search, UserCheck, UserX, X } from "lucide-react";
import { reviewApplicationAction, setUserActiveAction, setUserRoleAction } from "@/app/actions/admin";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { DownloadLink } from "@/components/common/download-link";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { roleLabel } from "@/components/layout/nav-links";
import { requirePageUser } from "@/lib/auth";
import { participantLabel } from "@/lib/constants";
import { formatDate, relativeTime } from "@/lib/format";
import { listApplications, listUsers } from "@/lib/server/users";
import { cn } from "@/lib/utils";
import type { Role } from "@/db/schema";

export const metadata: Metadata = { title: "People" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requirePageUser(["admin"]);
  const sp = await searchParams;
  const tab = sp.tab === "applications" ? "applications" : "people";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const role = ["participant", "organizer", "admin"].includes(String(sp.role)) ? (sp.role as Role) : undefined;
  const page = Number(sp.page) || 1;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="People"
        description="Accounts, roles and organizer applications. Administrator access is provisioned from the server only."
        actions={
          <DownloadLink href="/api/reports/users">Export CSV</DownloadLink>
        }
      />
      <nav className="mt-8 flex gap-1 border-b">
        {(["people", "applications"] as const).map((t) => (
          <Link
            key={t}
            href={t === "people" ? "/admin/users" : "/admin/users?tab=applications"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium capitalize",
              tab === t ? "border-signal text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "people" ? "All people" : "Organizer applications"}
          </Link>
        ))}
      </nav>
      {tab === "applications" ? <Applications /> : <People adminId={admin.id} q={q} role={role} page={page} />}
    </>
  );
}

async function Applications() {
  const apps = await listApplications("pending");
  if (!apps.length) return <EmptyState className="mt-6" icon={UserCheck} title="No pending applications" description="New organizer applications will show up here." />;
  return (
    <ul className="mt-6 space-y-3">
      {apps.map(({ app, name, email, institution }) => (
        <li key={app.id} className="surface p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold">{app.organization}</p>
              <p className="text-sm text-muted-foreground">
                {name} · {email}
                {institution ? ` · ${institution}` : ""}
              </p>
              <p className="mt-3 max-w-2xl text-sm">{app.reason}</p>
              <p className="mt-2 text-xs text-muted-foreground">Applied {relativeTime(app.createdAt)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <ConfirmAction
                action={reviewApplicationAction.bind(null, app.id, false)}
                variant="destructive-outline"
                icon={<X />}
                label="Decline"
                title="Decline application"
                description={`${name} stays a participant and is notified.`}
                note={{ label: "Note to applicant", placeholder: "e.g. Please apply through your faculty advisor." }}
              />
              <ConfirmAction
                action={reviewApplicationAction.bind(null, app.id, true)}
                icon={<Check />}
                label="Approve"
                title="Approve organizer"
                description={`${name} will be able to create and publish events immediately.`}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

async function People({ adminId, q, role, page }: { adminId: string; q?: string; role?: Role; page: number }) {
  const { rows, total, pages } = await listUsers({ q, role, page });
  const base = new URLSearchParams();
  if (q) base.set("q", q);
  if (role) base.set("role", role);
  return (
    <>
      <form className="mt-6 flex flex-col gap-2 sm:flex-row" action="/admin/users">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search name, email or institution" className="pl-9" aria-label="Search people" />
        </div>
        <NativeSelect name="role" defaultValue={role ?? ""} aria-label="Role" className="sm:w-44">
          <option value="">All roles</option>
          <option value="participant">Participants</option>
          <option value="organizer">Organizers</option>
          <option value="admin">Admins</option>
        </NativeSelect>
        <button className={buttonVariants({ variant: "outline" })} type="submit">
          Filter
        </button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">{total} people</p>
      <div className="surface mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-secondary/50 text-left">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-medium [&>th]:text-muted-foreground">
                <th>Person</th>
                <th>Role</th>
                <th>Category</th>
                <th className="text-right">Activity</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ profile: p, bookings, events }) => (
                <tr key={p.id} className={cn("[&>td]:px-4 [&>td]:py-3", !p.isActive && "opacity-60")}>
                  <td>
                    <p className="font-medium">{p.fullName}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge tone={p.role === "admin" ? "danger" : p.role === "organizer" ? "info" : "neutral"}>{roleLabel[p.role]}</StatusBadge>
                      {!p.isActive && <StatusBadge tone="warning">Deactivated</StatusBadge>}
                    </div>
                  </td>
                  <td className="text-muted-foreground">
                    <p className="text-sm font-medium text-foreground">
                      {p.institutionType === "SRM"
                        ? `SRM ${p.campus ?? "KTR"}`
                        : p.institutionType === "GUEST"
                          ? "External Guest"
                          : p.institutionName || p.institution || "Other College"}
                    </p>
                    <span className="block text-xs text-muted-foreground capitalize">
                      {p.affiliation ? p.affiliation.toLowerCase() : participantLabel(p.category)}
                      {p.city ? ` (${p.city})` : ""}
                      {p.department ? ` · ${p.department}` : ""}
                    </span>
                  </td>
                  <td className="text-right text-xs text-muted-foreground tabular">
                    {bookings} bookings{events ? ` · ${events} events` : ""}
                  </td>
                  <td className="text-muted-foreground">{formatDate(p.createdAt)}</td>
                  <td>
                    {p.role !== "admin" && p.id !== adminId ? (
                      <div className="flex justify-end gap-1.5">
                        {p.role === "participant" ? (
                          <ConfirmAction
                            action={setUserRoleAction.bind(null, p.id, "organizer")}
                            variant="outline"
                            size="xs"
                            label="Make organizer"
                            title="Grant organizer access"
                            description={`${p.fullName} will be able to create and publish events.`}
                          />
                        ) : (
                          <ConfirmAction
                            action={setUserRoleAction.bind(null, p.id, "participant")}
                            variant="outline"
                            size="xs"
                            label="Revoke organizer"
                            title="Remove organizer access"
                            description="Their existing events stay, but they can no longer manage them. Admins can still manage those events."
                          />
                        )}
                        {p.isActive ? (
                          <ConfirmAction
                            action={setUserActiveAction.bind(null, p.id, false)}
                            variant="destructive-outline"
                            size="xs"
                            icon={<UserX />}
                            label="Deactivate"
                            title="Deactivate account"
                            description="They're signed out and can't sign in until reactivated. Their bookings are kept."
                          />
                        ) : (
                          <ConfirmAction action={setUserActiveAction.bind(null, p.id, true)} variant="outline" size="xs" label="Reactivate" title="Reactivate account" />
                        )}
                      </div>
                    ) : (
                      <p className="text-right text-xs text-muted-foreground">—</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/admin/users?${new URLSearchParams({ ...Object.fromEntries(base), page: String(page - 1) })}`}>
              Previous
            </Link>
          )}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/admin/users?${new URLSearchParams({ ...Object.fromEntries(base), page: String(page + 1) })}`}>
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
