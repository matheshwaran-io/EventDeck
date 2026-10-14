import { notFound } from "next/navigation";
import { Download, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Meter } from "@/components/organizer/events-table";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { attendance } from "@/lib/server/checkin";
import { getManagedEvent } from "@/lib/server/events";

export default async function AttendancePage({ params }: PageProps<"/organizer/events/[id]/attendance">) {
  const { id } = await params;
  const user = await requirePageUser(["organizer", "admin"]);
  const data = await getManagedEvent(user, id);
  if (!data) notFound();
  const rows = await attendance(id);
  const validRows = rows.filter((r) => r.status === "valid");
  const checked = validRows.filter((r) => r.checkedInAt).length;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-sm space-y-2">
          <p className="text-sm">
            <span className="text-2xl font-semibold tabular">{checked}</span>
            <span className="text-muted-foreground"> of {validRows.length} valid tickets checked in</span>
          </p>
          <Meter value={checked} max={validRows.length} />
        </div>
        <a href={`/api/reports/attendance?eventId=${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Download /> Export CSV
        </a>
      </div>
      {rows.length === 0 ? (
        <EmptyState className="mt-6" icon={UsersRound} title="No tickets issued yet" description="Tickets appear here once you approve bookings." />
      ) : (
        <div className="surface mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-secondary/50 text-left">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-medium [&>th]:text-muted-foreground">
                  <th>Attendee</th>
                  <th>Tier</th>
                  <th>Ticket</th>
                  <th>Booked by</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.ticketNumber} className="[&>td]:px-4 [&>td]:py-3">
                    <td className="font-medium">{r.attendeeName}</td>
                    <td>{r.tierName}</td>
                    <td className="font-mono text-xs">{r.ticketNumber}</td>
                    <td className="text-muted-foreground">{r.buyer}</td>
                    <td className="text-right">
                      {r.status !== "valid" ? (
                        <StatusBadge tone="danger">Invalidated</StatusBadge>
                      ) : r.checkedInAt ? (
                        <StatusBadge tone="success">In · {formatTime(r.checkedInAt)}</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Not yet</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
