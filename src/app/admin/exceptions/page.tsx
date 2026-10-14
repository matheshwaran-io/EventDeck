import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { resolveExceptionAction } from "@/app/actions/admin";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { BookingBadges } from "@/components/bookings/booking-badges";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader, SectionHeading } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, formatPaise } from "@/lib/format";
import { exceptionList, flaggedPayments } from "@/lib/server/queries";

export const metadata: Metadata = { title: "Payment exceptions" };

const FLAG_LABEL: Record<string, string> = {
  duplicate_payment: "Duplicate payment",
  late_payment_recovered: "Late payment — seats re-allocated",
  paid_after_event_cancellation: "Paid after cancellation — refund queued",
};

export default async function ExceptionsPage({ searchParams }: PageProps<"/admin/exceptions">) {
  await requirePageUser(["admin"]);
  const { resolved } = await searchParams;
  const showResolved = resolved === "1";
  const [rows, flagged] = await Promise.all([exceptionList(showResolved), flaggedPayments()]);
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Payment exceptions"
        description="Successful payments that couldn't be applied normally — late payments with no seats left, or paid bookings an organizer rejected. Nothing here is ever silently discarded."
      />
      <div className="mt-8 flex justify-end">
        <Link href={showResolved ? "/admin/exceptions" : "/admin/exceptions?resolved=1"} className="text-sm font-medium link-underline">
          {showResolved ? "Hide resolved" : "Show resolved"}
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState className="mt-4" icon={CheckCircle2} title="No open exceptions" description="Every captured payment is accounted for." />
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.booking.id} className="surface p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{r.booking.reference}</span>
                    <BookingBadges booking={r.booking} />
                  </div>
                  <p className="text-sm">
                    {r.eventTitle} · {r.buyer} <span className="text-muted-foreground">({r.email})</span>
                  </p>
                  <p className="text-sm text-destructive">{r.booking.exceptionReason}</p>
                  <p className="text-xs text-muted-foreground">
                    Captured {formatPaise(r.paidPaise)} · <span className="font-mono">{r.paymentRefs ?? "—"}</span> · {formatDateTime(r.booking.updatedAt)}
                  </p>
                  {r.booking.exceptionResolvedAt && (
                    <p className="text-xs">
                      <StatusBadge tone="success">Resolved</StatusBadge> <span className="ml-1 text-muted-foreground">{r.booking.exceptionNote}</span>
                    </p>
                  )}
                </div>
                {!r.booking.exceptionResolvedAt && (
                  <ConfirmAction
                    action={resolveExceptionAction.bind(null, r.booking.id)}
                    variant="outline"
                    label="Mark resolved"
                    title="Resolve exception"
                    description="Record how this payment was handled (e.g. refunded from the Razorpay test dashboard, or seat honoured manually). The participant is notified."
                    note={{ label: "Resolution", required: true, minLength: 5 }}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {flagged.length > 0 && (
        <section className="mt-12">
          <SectionHeading title="Flagged payments" description="Handled automatically, listed for reconciliation." />
          <ul className="surface divide-y text-sm">
            {flagged.map((f) => (
              <li key={f.payment.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="font-mono text-xs">{f.reference}</span> · {f.eventTitle}
                </span>
                <span className="flex items-center gap-3">
                  <StatusBadge tone="info">{FLAG_LABEL[f.payment.flag ?? ""] ?? f.payment.flag}</StatusBadge>
                  <span className="tabular">{formatPaise(f.payment.amountPaise)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
