import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { processAllRefundsAction, processRefundAction } from "@/app/actions/admin";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { DownloadLink } from "@/components/common/download-link";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { requirePageUser } from "@/lib/auth";
import { REFUND_STATUS } from "@/lib/constants";
import { formatDateTime, formatPaise } from "@/lib/format";
import { paymentMode } from "@/lib/razorpay";
import { refundList } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Refunds" };

export default async function RefundsPage({ searchParams }: PageProps<"/admin/refunds">) {
  await requirePageUser(["admin"]);
  const { status: s } = await searchParams;
  const status = s === "processed" || s === "failed" || s === "pending" ? s : undefined;
  const rows = await refundList(status);
  const actionable = rows.filter((r) => r.refund.status === "pending" || r.refund.status === "failed").length;
  const mode = paymentMode();

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Refunds"
        description="Refunds exist only for officially cancelled events. Everything here runs in Razorpay Test Mode — no real money moves."
        actions={
          <>
            <DownloadLink href="/api/reports/refunds">Export CSV</DownloadLink>
            {actionable > 0 && (
              <ConfirmAction
                action={processAllRefundsAction}
                icon={<RotateCcw />}
                label={`Process all (${actionable})`}
                title="Process all pending refunds"
                description={mode === "razorpay" ? "Each refund is submitted to Razorpay Test Mode." : "Simulated payments are refunded in the local simulator."}
              />
            )}
          </>
        }
      />
      <nav className="mt-8 flex gap-1.5">
        {[undefined, "pending", "failed", "processed"].map((t) => (
          <Link
            key={t ?? "all"}
            href={t ? `/admin/refunds?status=${t}` : "/admin/refunds"}
            className={cn(
              "h-9 rounded-full border px-4 text-sm leading-9 font-medium capitalize",
              status === t ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t ?? "All"}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState className="mt-6" icon={RotateCcw} title="No refunds" description="Refunds are queued automatically when a paid event is cancelled." />
      ) : (
        <div className="surface mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-secondary/50 text-left">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-medium [&>th]:text-muted-foreground">
                  <th>Booking</th>
                  <th>Event</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.refund.id} className="[&>td]:px-4 [&>td]:py-3">
                    <td>
                      <p className="font-mono text-xs">{r.reference}</p>
                      <p className="text-xs text-muted-foreground">{r.buyer}</p>
                    </td>
                    <td className="max-w-56 truncate">{r.eventTitle}</td>
                    <td className="text-right font-medium tabular">{formatPaise(r.refund.amountPaise)}</td>
                    <td>
                      <StatusBadge tone={REFUND_STATUS[r.refund.status].tone}>{REFUND_STATUS[r.refund.status].label}</StatusBadge>
                      {r.refund.failureReason && <p className="mt-1 max-w-48 text-xs text-destructive">{r.refund.failureReason}</p>}
                      {r.refund.providerRefundId && <p className="mt-1 font-mono text-[0.6875rem] text-muted-foreground">{r.refund.providerRefundId}</p>}
                    </td>
                    <td className="text-xs text-muted-foreground">{formatDateTime(r.refund.updatedAt)}</td>
                    <td className="text-right">
                      {(r.refund.status === "pending" && !r.refund.providerRefundId) || r.refund.status === "failed" ? (
                        <ConfirmAction
                          action={processRefundAction.bind(null, r.refund.id)}
                          size="xs"
                          label={r.refund.status === "failed" ? "Retry" : "Process"}
                          title={`Refund ${formatPaise(r.refund.amountPaise)}?`}
                          description={`${r.provider === "mock" ? "Simulated payment — refunded locally." : "Submitted to Razorpay Test Mode."} Booking ${r.reference}.`}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{r.refund.status === "pending" ? "Awaiting webhook" : "—"}</span>
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
