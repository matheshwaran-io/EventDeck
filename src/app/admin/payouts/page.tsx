import type { Metadata } from "next";
import Link from "next/link";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  Landmark,
  Smartphone,
  XCircle,
} from "lucide-react";
import { ProcessPayoutDialog } from "@/components/admin/process-payout-dialog";
import { DownloadLink } from "@/components/common/download-link";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, formatPaise } from "@/lib/format";
import { getAdminPayoutsOverview } from "@/lib/server/payouts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payouts & Settlements — Admin" };

const TABS = [
  { key: "all", label: "All" },
  { key: "requested", label: "Requested" },
  { key: "completed", label: "Completed" },
  { key: "rejected", label: "Rejected" },
] as const;

export default async function AdminPayoutsPage({
  searchParams,
}: PageProps<"/admin/payouts">) {
  await requirePageUser(["admin"]);
  const { status: s } = await searchParams;
  const currentTab = TABS.some((t) => t.key === s) ? s! : "all";

  const data = await getAdminPayoutsOverview();

  const filteredPayouts = data.payouts.filter((p) => {
    if (currentTab === "all") return true;
    if (currentTab === "requested") return p.status === "requested" || p.status === "processing";
    return p.status === currentTab;
  });

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-6xl">
      <PageHeader
        eyebrow="Administration"
        title="Payouts & Settlements"
        description="Review and disburse ticket proceeds collected from university events to organizers."
        actions={
          <div className="flex items-center gap-2">
            <DownloadLink href="/api/reports/payments">Export Payments CSV</DownloadLink>
          </div>
        }
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-card shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Total Ticket Sales</span>
              <Coins className="size-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {formatPaise(data.metrics.totalRevenuePaise)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Gross collections across platform</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Platform Fee (5%)</span>
              <Banknote className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {formatPaise(data.metrics.totalPlatformFeesPaise)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Retained by university/platform</p>
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning-soft/30 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-warning">
              <span className="text-xs font-medium">Pending Requests</span>
              <Clock className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-warning">
              {formatPaise(data.metrics.pendingPayoutsPaise)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.metrics.pendingCount} request(s) awaiting disbursement
            </p>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success-soft/30 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-success">
              <span className="text-xs font-medium">Total Disbursed</span>
              <CheckCircle2 className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-success">
              {formatPaise(data.metrics.disbursedPayoutsPaise)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.metrics.disbursedCount} settlement(s) completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b pb-3">
        {TABS.map((t) => {
          const active = currentTab === t.key;
          return (
            <Link
              key={t.key}
              href={t.key === "all" ? "/admin/payouts" : `/admin/payouts?status=${t.key}`}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-medium transition-colors flex items-center gap-1.5",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.key === "requested" && data.metrics.pendingCount > 0 && (
                <span className="rounded-full bg-warning px-1.5 py-0.2 text-[0.6875rem] font-bold text-black">
                  {data.metrics.pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Payouts Table */}
      {filteredPayouts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No settlements found"
          description={
            currentTab === "requested"
              ? "There are no pending settlement requests from organizers right now."
              : "No payout records matching this filter."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Reference / Event</th>
                  <th className="px-4 py-3">Organizer</th>
                  <th className="px-4 py-3">Beneficiary Account</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Net Disbursable</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPayouts.map((p) => {
                  const b = p.beneficiarySnapshot;
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {p.reference}
                        </span>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {p.eventTitle}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">{p.organizerName}</div>
                        <div className="text-xs text-muted-foreground">{p.organizerEmail}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                          {b.accountType === "upi" ? (
                            <Smartphone className="size-3.5 text-primary" />
                          ) : (
                            <Building2 className="size-3.5 text-primary" />
                          )}
                          <span>{b.beneficiaryName}</span>
                        </div>
                        <p className="font-mono text-[0.6875rem] text-muted-foreground">
                          {b.accountType === "upi"
                            ? b.upiId
                            : `${b.bankName || "Bank"} ·•••${b.accountNumber?.slice(-4)} (${b.ifscCode})`}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {formatPaise(p.amountPaise)}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-foreground">
                        {formatPaise(p.netAmountPaise)}
                      </td>
                      <td className="px-4 py-3.5">
                        {p.status === "completed" && (
                          <Badge variant="outline" className="border-success/30 bg-success-soft text-success">
                            <CheckCircle2 className="size-3" /> Disbursed
                          </Badge>
                        )}
                        {(p.status === "requested" || p.status === "processing") && (
                          <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
                            <Clock className="size-3" /> In Review
                          </Badge>
                        )}
                        {p.status === "rejected" && (
                          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                            <XCircle className="size-3" /> Declined
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ProcessPayoutDialog payout={p} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
