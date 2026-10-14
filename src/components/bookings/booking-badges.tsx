import type { Booking } from "@/db/schema";
import { BOOKING_STATUS, PAYMENT_STATUS, REFUND_STATUS } from "@/lib/constants";
import { StatusBadge } from "@/components/common/status-badge";

export function BookingBadges({ booking, compact }: { booking: Pick<Booking, "status" | "paymentStatus" | "refundStatus" | "kind">; compact?: boolean }) {
  const s = BOOKING_STATUS[booking.status];
  const p = PAYMENT_STATUS[booking.paymentStatus];
  const r = REFUND_STATUS[booking.refundStatus];
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
      {booking.kind === "paid" && (!compact || booking.paymentStatus !== "paid" || booking.status !== "approved") && (
        <StatusBadge tone={p.tone}>{p.label}</StatusBadge>
      )}
      {booking.kind === "complimentary" && <StatusBadge tone="neutral">Complimentary</StatusBadge>}
      {booking.refundStatus !== "not_applicable" && <StatusBadge tone={r.tone}>{r.label}</StatusBadge>}
    </div>
  );
}
