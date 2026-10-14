import type { Metadata } from "next";
import Link from "next/link";
import { AlertOctagon, ArrowRight, CalendarRange, IndianRupee, RotateCcw, ScanLine, Ticket, UserPlus, Users, XCircle } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/common/page-header";
import { Stat } from "@/components/common/stat";
import { AuditTable } from "@/components/organizer/audit-table";
import { requirePageUser } from "@/lib/auth";
import { formatInr } from "@/lib/format";
import { adminMetrics, auditTrail, salesByDay } from "@/lib/server/queries";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  await requirePageUser(["admin"]);
  const [m, days, recent] = await Promise.all([adminMetrics(), salesByDay(14), auditTrail({ pageSize: 8 })]);
  const peak = Math.max(1, ...days.map((d) => d.paise));
  const total14 = days.reduce((a, d) => a + d.paise, 0);

  const tasks = [
    { n: m.pendingApplications, label: "organizer application(s)", href: "/admin/users?tab=applications", icon: UserPlus },
    { n: m.pendingCancellations, label: "cancellation request(s)", href: "/admin/cancellations", icon: XCircle },
    { n: m.refunds.pending, label: "refund(s) to process", href: "/admin/refunds", icon: RotateCcw },
    { n: m.openExceptions, label: "payment exception(s)", href: "/admin/exceptions", icon: AlertOctagon },
  ].filter((t) => t.n > 0);

  return (
    <>
      <PageHeader eyebrow="Administration" title="Campus overview" description="Registrations, sales, attendance and everything waiting on an administrator." />

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Live events" value={m.events.upcoming} icon={CalendarRange} hint={`${m.events.drafts} drafts · ${m.events.cancelled} cancelled`} />
        <Stat label="Tickets approved" value={m.bookings.ticketsSold} icon={Ticket} hint={`${m.bookings.pending} booking(s) awaiting organizers`} />
        <Stat label="Payments (test)" value={formatInr(m.payments.totalPaise)} icon={IndianRupee} hint={`${m.payments.count} captured`} />
        <Stat label="Check-ins" value={m.checkIns} icon={ScanLine} hint={`${m.users.total} people · ${m.users.organizers} organizers`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Ticket sales · last 14 days</h2>
            <p className="text-sm text-muted-foreground tabular">{formatInr(total14)}</p>
          </div>
          <div className="mt-6 flex h-40 items-end gap-1.5" role="img" aria-label={`Daily ticket sales for the last 14 days, total ${formatInr(total14)}`}>
            {days.map((d) => (
              <div key={d.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div
                  className="w-full rounded-t-[3px] bg-foreground/85 transition-colors group-hover:bg-signal"
                  style={{ height: `${Math.max(2, (d.paise / peak) * 100)}%`, opacity: d.paise ? 1 : 0.15 }}
                  title={`${d.key}: ${formatInr(d.paise)}`}
                />
                <span className="text-[0.625rem] text-muted-foreground tabular">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="surface p-5">
          <h2 className="text-sm font-semibold">Needs your attention</h2>
          {tasks.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Nothing waiting. Everything is up to date.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {tasks.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} className="flex items-center gap-3 rounded-lg border px-3 py-3 text-sm transition-colors hover:bg-secondary">
                    <t.icon className="size-4 text-signal" />
                    <span className="flex-1">
                      <span className="font-semibold tabular">{t.n}</span> {t.label}
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
            <div>
              <p className="text-muted-foreground">Refunded (test)</p>
              <p className="font-semibold tabular">{formatInr(m.refunds.processedPaise)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Participants</p>
              <p className="flex items-center gap-1.5 font-semibold tabular">
                <Users className="size-3.5" /> {m.users.participants}
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-10">
        <SectionHeading
          title="Latest activity"
          action={
            <Link href="/admin/audit" className="text-sm font-medium link-underline">
              Audit log
            </Link>
          }
        />
        <AuditTable rows={recent.rows} showEvent />
      </section>
    </>
  );
}
