import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditTable } from "@/components/organizer/audit-table";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { getManagedEvent } from "@/lib/server/events";
import { auditTrail } from "@/lib/server/queries";

export default async function ActivityPage({ params, searchParams }: PageProps<"/organizer/events/[id]/activity">) {
  const { id } = await params;
  const { page: p } = await searchParams;
  const user = await requirePageUser(["organizer", "admin"]);
  const data = await getManagedEvent(user, id);
  if (!data) notFound();
  const page = Number(p) || 1;
  const trail = await auditTrail({ eventId: id, page });
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">Every decision, payment update and check-in for this event, newest first.</p>
      <AuditTable rows={trail.rows} />
      {trail.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {page > 1 && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`?page=${page - 1}`}>Previous</Link>}
          <span className="text-sm text-muted-foreground">Page {page} of {trail.pages}</span>
          {page < trail.pages && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`?page=${page + 1}`}>Next</Link>}
        </div>
      )}
    </>
  );
}
