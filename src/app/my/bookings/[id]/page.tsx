import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { AlertTriangle, ArrowLeft, Check, Clock, Download, MapPin, ReceiptText, RotateCcw } from "lucide-react";
import { BookingBadges } from "@/components/bookings/booking-badges";
import { CancelRequestButton, CheckoutPanel } from "@/components/bookings/checkout-panel";
import { BookingLiveRefresh } from "@/components/bookings/live-refresh";
import { StatusBadge } from "@/components/common/status-badge";
import { PosterArt } from "@/components/events/poster-art";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { REFUND_STATUS } from "@/lib/constants";
import { qrPayload } from "@/lib/domain/tokens";
import { ticketsShouldBeValid } from "@/lib/domain/transitions";
import { formatDateTime, formatPaise, formatRange, formatTime } from "@/lib/format";
import { bookingDetail } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Booking" };

type Step = { label: string; done: boolean; current?: boolean; failed?: boolean; detail?: string };

export default async function BookingPage({ params }: PageProps<"/my/bookings/[id]">) {
  const { id } = await params;
  const user = await requirePageUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await bookingDetail(user, id);
  if (!data) notFound();
  const { booking: b, event, items, tickets, payments, refund } = data;
  const isOwner = b.userId === user.id;
  const valid = ticketsShouldBeValid({ bookingStatus: b.status, paymentStatus: b.paymentStatus, eventStatus: event.status });

  const closed = ["rejected", "cancelled", "expired", "event_cancelled", "payment_exception"].includes(b.status);
  const steps: Step[] = [
    { label: b.kind === "complimentary" ? "Pass requested" : b.kind === "free" ? "Registered" : "Seats reserved", done: true, detail: formatDateTime(b.createdAt) },
    ...(b.kind === "paid"
      ? [
          {
            label: "Payment",
            done: b.paymentStatus === "paid",
            current: b.status === "awaiting_payment",
            failed: b.paymentStatus === "failed" || b.paymentStatus === "expired",
            detail: b.paymentStatus === "paid" ? "Verified by server" : b.paymentStatus === "failed" ? "Last attempt failed" : undefined,
          },
        ]
      : []),
    {
      label: "Organizer verification",
      done: b.status === "approved" || (b.status === "event_cancelled" && Boolean(b.decidedAt)),
      current: b.status === "pending_verification",
      failed: b.status === "rejected",
      detail: b.decidedAt ? formatDateTime(b.decidedAt) : b.status === "pending_verification" ? "In the organizer's queue" : undefined,
    },
    { label: "Tickets issued", done: valid, failed: closed && tickets.length > 0, detail: valid ? `${tickets.length} ticket(s)` : undefined },
  ];

  const qrSvgs = valid
    ? await Promise.all(
        tickets.map(({ ticket }) =>
          QRCode.toString(qrPayload(ticket.qrToken), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1f1b17", light: "#00000000" } }),
        ),
      )
    : [];

  return (
    <>
      <BookingLiveRefresh bookingId={b.id} />
      <Link href="/my/bookings" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> My tickets
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <PosterArt
          title={event.title}
          category={event.category}
          startAt={event.startAt}
          posterPath={event.posterPath}
          seed={event.slug}
          size="thumb"
          className="hidden size-28 shrink-0 rounded-xl sm:block"
        />
        <div className="min-w-0 flex-1">
          <p className="eyebrow font-mono">{b.reference}</p>
          <h1 className="font-display mt-2 text-[2.25rem] leading-[1.05] text-balance">
            <Link href={`/events/${event.slug}`} className="hover:underline hover:decoration-1 hover:underline-offset-4">
              {event.title}
            </Link>
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Clock className="size-3.5" />{formatRange(event.startAt, event.endAt)}</span>
            <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{event.venue}</span>
          </p>
          <div className="mt-4">
            <BookingBadges booking={b} />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Status alerts */}
          {b.status === "event_cancelled" && (
            <Alert tone="danger" title="This event was cancelled">
              {event.cancellationReason ?? "The organizer cancelled this event."} Your tickets are no longer valid.
              {b.refundStatus !== "not_applicable" && ` Refund status: ${REFUND_STATUS[b.refundStatus].label.toLowerCase()}.`}
            </Alert>
          )}
          {b.status === "rejected" && (
            <Alert tone="danger" title="The organizer didn't approve this booking">
              {b.decisionNote ?? "No reason was given."}
              {b.paymentStatus === "paid" && " Your payment has been flagged for administrative review — individual refunds aren't issued in-app."}
            </Alert>
          )}
          {b.status === "payment_exception" && (
            <Alert tone="danger" title="Payment received, but no tickets were issued">
              {b.exceptionReason} {b.exceptionResolvedAt ? `Resolved: ${b.exceptionNote}` : "An administrator will follow up."}
            </Alert>
          )}
          {b.status === "expired" && <Alert tone="neutral" title="Reservation expired">Payment wasn&apos;t completed in time, so the seats were released.</Alert>}
          {b.status === "cancelled" && <Alert tone="neutral" title="Booking cancelled">This booking was cancelled before payment.</Alert>}
          {b.status === "pending_verification" && (
            <Alert tone="info" title="Waiting for organizer verification">
              {b.kind === "paid" ? "Your payment is confirmed." : "Your request has been received."} Tickets become valid as soon as the organizer approves — we&apos;ll notify you.
            </Alert>
          )}

          {/* Tickets */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Tickets</h2>
              {valid && isOwner && (
                <a href={`/api/tickets/${b.id}/pdf`} className={buttonVariants({ size: "sm" })} download>
                  <Download /> Download PDF
                </a>
              )}
            </div>
            {valid ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {tickets.map(({ ticket, tierName, checkedInAt }, i) => (
                  <li key={ticket.id} className="relative overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)]">
                    <div className="flex items-center justify-between bg-foreground px-4 py-2.5 text-background">
                      <span className="font-mono text-[0.6875rem] tracking-[0.14em] uppercase">Admit one · {i + 1}/{tickets.length}</span>
                      <span className="text-xs font-semibold text-signal">{tierName}</span>
                    </div>
                    <div className="flex gap-4 p-4">
                      <div
                        className="size-28 shrink-0 rounded-md bg-white p-2 ring-1 ring-border [&_svg]:size-full"
                        role="img"
                        aria-label={`QR code for ticket ${ticket.ticketNumber}`}
                        dangerouslySetInnerHTML={{ __html: qrSvgs[i]! }}
                      />
                      <div className="min-w-0 space-y-2 text-sm">
                        <div>
                          <p className="eyebrow text-[0.625rem]">Attendee</p>
                          <p className="truncate font-medium">{ticket.attendeeName}</p>
                        </div>
                        <div>
                          <p className="eyebrow text-[0.625rem]">Ticket no.</p>
                          <p className="font-mono text-xs">{ticket.ticketNumber}</p>
                        </div>
                        {checkedInAt ? (
                          <StatusBadge tone="neutral">Checked in {formatTime(checkedInAt)}</StatusBadge>
                        ) : (
                          <StatusBadge tone="success">Valid</StatusBadge>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
                {tickets.length > 0
                  ? "These tickets have been invalidated and can't be used for entry."
                  : closed
                    ? "No tickets were issued for this booking."
                    : "Your tickets and QR codes will appear here once the booking is approved."}
              </div>
            )}
          </section>

          {/* Timeline */}
          <section>
            <h2 className="mb-3 text-base font-semibold">Progress</h2>
            <ol className="surface divide-y">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full ring-1",
                      s.done && "bg-success text-white ring-success",
                      s.failed && !s.done && "bg-danger-soft text-destructive ring-destructive/30",
                      s.current && !s.done && !s.failed && "bg-signal-soft text-signal ring-signal/40",
                      !s.done && !s.failed && !s.current && "text-muted-foreground ring-border",
                    )}
                  >
                    {s.done ? <Check className="size-3.5" /> : s.failed ? <AlertTriangle className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <span className="flex-1 text-sm font-medium">{s.label}</span>
                  {s.detail && <span className="text-xs text-muted-foreground">{s.detail}</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          {isOwner && b.status === "awaiting_payment" && b.expiresAt && (
            <CheckoutPanel bookingId={b.id} amountPaise={b.amountPaise} expiresAt={b.expiresAt.toISOString()} paymentFailed={b.paymentStatus === "failed"} />
          )}

          <div className="surface p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ReceiptText className="size-4 text-muted-foreground" /> Summary
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              {items.map(({ item, tierName }) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>
                    {tierName} × {item.quantity}
                  </span>
                  <span className="tabular">{formatPaise(item.unitPricePaise * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t pt-3 font-semibold">
              <span>Total</span>
              <span className="tabular">{b.amountPaise ? formatPaise(b.amountPaise) : "Free"}</span>
            </div>
            {b.passReason && (
              <div className="mt-4 rounded-lg bg-secondary p-3 text-xs">
                <p className="font-medium">Pass request</p>
                <p className="mt-1 text-muted-foreground">{b.passReason}</p>
              </div>
            )}
            {isOwner && b.status === "pending_verification" && b.paymentStatus === "not_required" && (
              <div className="mt-4">
                <CancelRequestButton bookingId={b.id} />
              </div>
            )}
          </div>

          {(payments.length > 0 || refund) && (
            <div className="surface p-5">
              <h2 className="text-sm font-semibold">Payments</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{p.paymentId ?? p.orderId}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(p.paidAt ?? p.createdAt)} · {p.provider === "mock" ? "simulated" : "Razorpay test"}
                      </p>
                    </div>
                    <StatusBadge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "neutral"}>
                      {p.status === "created" ? "Started" : p.status === "paid" ? "Paid" : "Failed"}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
              {refund && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-secondary p-3 text-sm">
                  <span className="flex items-center gap-2">
                    <RotateCcw className="size-4 text-muted-foreground" /> Refund {formatPaise(refund.amountPaise)}
                  </span>
                  <StatusBadge tone={REFUND_STATUS[refund.status].tone}>{REFUND_STATUS[refund.status].label}</StatusBadge>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Alert({ tone, title, children }: { tone: "danger" | "info" | "neutral"; title: string; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-4 py-3.5 text-sm",
        tone === "danger" && "border-destructive/20 bg-danger-soft",
        tone === "info" && "border-info/15 bg-info-soft",
        tone === "neutral" && "bg-secondary",
      )}
    >
      <p className={cn("font-semibold", tone === "danger" && "text-destructive", tone === "info" && "text-info")}>{title}</p>
      <p className="mt-0.5 text-foreground/80">{children}</p>
    </div>
  );
}
