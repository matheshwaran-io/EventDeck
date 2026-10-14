import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { AuditTable } from "@/components/organizer/audit-table";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { auditTrail } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

const GROUPS = [
  { key: "", label: "Everything" },
  { key: "booking", label: "Bookings" },
  { key: "payment", label: "Payments" },
  { key: "refund", label: "Refunds" },
  { key: "event", label: "Events" },
  { key: "checkin", label: "Check-ins" },
  { key: "organizer", label: "Organizers" },
  { key: "user", label: "Users" },
  { key: "report", label: "Exports" },
];

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePageUser(["admin"]);
  const sp = await searchParams;
  const group = GROUPS.find((g) => g.key === sp.action)?.key ?? "";
  const page = Number(sp.page) || 1;
  const trail = await auditTrail({ action: group ? `${group}.` : undefined, page });
  const href = (p: number) => `/admin/audit?${new URLSearchParams({ ...(group ? { action: group } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader eyebrow="Administration" title="Audit log" description={`${trail.total} recorded actions. Secrets, tokens and card data are never logged.`} />
      <div className="-mx-4 mt-8 mb-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {GROUPS.map((g) => (
          <Link
            key={g.key}
            href={g.key ? `/admin/audit?action=${g.key}` : "/admin/audit"}
            className={cn(
              "h-9 shrink-0 rounded-full border px-4 text-sm leading-9 font-medium",
              group === g.key ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {g.label}
          </Link>
        ))}
      </div>
      <AuditTable rows={trail.rows} showEvent />
      {trail.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={href(page - 1)}>Previous</Link>}
          <span className="text-muted-foreground">Page {page} of {trail.pages}</span>
          {page < trail.pages && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={href(page + 1)}>Next</Link>}
        </div>
      )}
    </>
  );
}
