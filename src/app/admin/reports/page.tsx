import type { Metadata } from "next";
import { CalendarRange, CreditCard, Download, RotateCcw, ScrollText, Ticket, Users } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Reports" };

const REPORTS = [
  { type: "bookings", title: "Registrations", description: "Every booking with verification, payment and refund status.", icon: Ticket },
  { type: "payments", title: "Payments", description: "Orders and captured payments with confirmation source and flags.", icon: CreditCard },
  { type: "events", title: "Events & sales", description: "Capacity, approvals, revenue and check-ins per event.", icon: CalendarRange },
  { type: "refunds", title: "Refunds", description: "Refunds for cancelled events and their status.", icon: RotateCcw },
  { type: "users", title: "People", description: "Accounts, roles and participant categories.", icon: Users },
  { type: "audit", title: "Audit log (latest 100)", description: "Recent system-wide actions with actors.", icon: ScrollText },
];

export default async function ReportsPage() {
  await requirePageUser(["admin"]);
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Reports"
        description="CSV exports generated from live data on the server. Text fields are sanitised against spreadsheet formula injection, and each export is recorded in the audit log."
      />
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <li key={r.type} className="surface flex flex-col p-5">
            <r.icon className="size-5 text-signal" strokeWidth={1.75} />
            <p className="mt-4 font-semibold">{r.title}</p>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.description}</p>
            <a href={`/api/reports/${r.type}`} className={buttonVariants({ variant: "outline", size: "sm", className: "mt-5 self-start" })}>
              <Download /> Download CSV
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">Per-event attendance exports are on each event&apos;s Attendance tab.</p>
    </>
  );
}
