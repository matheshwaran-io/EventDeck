import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePageUser } from "@/lib/auth";
import { adminMetrics } from "@/lib/server/queries";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["admin"], "/admin");
  const m = await adminMetrics();
  return (
    <DashboardShell
      title="Administration"
      links={[
        { href: "/admin", label: "Overview", icon: "dashboard", exact: true },
        { href: "/admin/events", label: "Events", icon: "events" },
        { href: "/admin/users", label: "People", icon: "users", badge: m.pendingApplications },
        { href: "/admin/cancellations", label: "Cancellations", icon: "cancellations", badge: m.pendingCancellations },
        { href: "/admin/refunds", label: "Refunds", icon: "refunds", badge: m.refunds.pending },
        { href: "/admin/exceptions", label: "Exceptions", icon: "exceptions", badge: m.openExceptions },
        { href: "/admin/reports", label: "Reports", icon: "reports" },
        { href: "/admin/audit", label: "Audit log", icon: "audit" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
