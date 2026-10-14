import Link from "next/link";
import type { auditTrail } from "@/lib/server/queries";
import { formatDateTime } from "@/lib/format";
import { describeAction, detailSummary } from "./activity-list";

type Rows = Awaited<ReturnType<typeof auditTrail>>["rows"];

export function AuditTable({ rows, showEvent }: { rows: Rows; showEvent?: boolean }) {
  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-secondary/50 text-left">
            <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-medium [&>th]:text-muted-foreground">
              <th className="w-44">When</th>
              <th>Who</th>
              <th>Action</th>
              {showEvent && <th>Event</th>}
              <th>Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={showEvent ? 5 : 4} className="px-4 py-10 text-center text-muted-foreground">
                  No activity recorded.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.log.id} className="align-top [&>td]:px-4 [&>td]:py-3">
                <td className="text-xs whitespace-nowrap text-muted-foreground tabular">{formatDateTime(r.log.createdAt)}</td>
                <td>
                  <p className="font-medium">{r.actorName ?? "System"}</p>
                  {r.actorRole && <p className="text-xs text-muted-foreground capitalize">{r.actorRole}</p>}
                </td>
                <td>
                  <p>{describeAction(r.log.action).replace(/^— /, "")}</p>
                  <code className="text-[0.6875rem] text-muted-foreground">{r.log.action}</code>
                </td>
                {showEvent && (
                  <td className="max-w-48 truncate">
                    {r.log.eventId ? (
                      <Link href={`/organizer/events/${r.log.eventId}`} className="hover:underline">
                        {r.eventTitle}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                )}
                <td className="max-w-sm text-xs break-words text-muted-foreground">{detailSummary(r.log.details) || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
