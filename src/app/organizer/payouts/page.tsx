import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  HelpCircle,
  Landmark,
  ShieldCheck,
  Smartphone,
  Wallet,
  XCircle,
} from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/common/page-header";
import { PayoutAccountForm } from "@/components/organizer/payout-account-form";
import { RequestPayoutDialog } from "@/components/organizer/request-payout-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, formatPaise } from "@/lib/format";
import { getOrganizerPayoutsData } from "@/lib/server/payouts";

export const metadata: Metadata = { title: "Payouts & Settlements — Organizer" };

export default async function OrganizerPayoutsPage() {
  const user = await requirePageUser(["organizer", "admin"]);
  const data = await getOrganizerPayoutsData(user.id);

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-6xl">
      <PageHeader
        eyebrow="Organizer Financials"
        title="Payouts & Settlements"
        description="Track ticket revenue, configure your bank / UPI settlement destination, and request payouts."
        actions={<PayoutAccountForm existing={data.account} />}
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-card shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Gross Ticket Sales</span>
              <Coins className="size-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {formatPaise(data.metrics.totalGrossPaise)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Collected from paid bookings</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Platform Fee (5%)</span>
              <Banknote className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {formatPaise(data.metrics.totalFeePaise)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Platform operational charges</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Settled to Bank</span>
              <CheckCircle2 className="size-4 text-success" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {formatPaise(data.metrics.totalDisbursedPaise)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Total disbursed payouts</p>
          </CardContent>
        </Card>

        <Card className="border-primary/40 bg-primary/5 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-primary">
              <span className="text-xs font-medium">Available for Payout</span>
              <Wallet className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-primary">
              {formatPaise(data.metrics.availablePaise)}
            </div>
            <p className="mt-1 text-xs text-primary/80">Ready for withdrawal</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Destination Summary */}
      <Card className="overflow-hidden border bg-card">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="rounded-xl border bg-muted/60 p-2.5 text-foreground">
              {data.account?.accountType === "upi" ? (
                <Smartphone className="size-6 text-primary" />
              ) : (
                <Landmark className="size-6 text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {data.account ? data.account.beneficiaryName : "No Payout Destination Set"}
                </h3>
                {data.account && (
                  <Badge variant="outline" className="border-success/30 bg-success-soft text-success text-[0.6875rem]">
                    <CheckCircle2 className="size-3" /> Verified (Test Mode)
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.account ? (
                  data.account.accountType === "upi" ? (
                    <span>
                      UPI ID: <strong className="font-mono text-foreground">{data.account.upiId}</strong>
                    </span>
                  ) : (
                    <span>
                      {data.account.bankName || "Bank"} · Account:{" "}
                      <strong className="font-mono text-foreground">
                        ••••{data.account.accountNumber?.slice(-4)}
                      </strong>{" "}
                      · IFSC: <strong className="font-mono text-foreground">{data.account.ifscCode}</strong>
                    </span>
                  )
                ) : (
                  "Add your bank account or UPI address to enable settlement requests for your events."
                )}
              </p>
            </div>
          </div>
          <PayoutAccountForm existing={data.account} />
        </div>
      </Card>

      {/* Event Balances & Withdrawal Actions */}
      <div className="space-y-4">
        <SectionHeading
          title="Event Balances"
          description="Ticket collections and settlement availability by event."
        />

        {data.events.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No events found. Once you create an event and attendees buy tickets, balances will appear here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Paid Tickets</th>
                    <th className="px-4 py-3">Gross Sales</th>
                    <th className="px-4 py-3">Fee (5%)</th>
                    <th className="px-4 py-3">Settled</th>
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.events.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/organizer/events/${e.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {e.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{e.venue}</p>
                      </td>
                      <td className="px-4 py-3.5 font-medium">{e.paidBookingsCount}</td>
                      <td className="px-4 py-3.5 font-semibold text-foreground">
                        {formatPaise(e.grossPaise)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {formatPaise(e.feePaise)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-success font-medium">
                        {formatPaise(e.disbursedPaise)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`font-semibold ${
                            e.availablePaise > 0 ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {formatPaise(e.availablePaise)}
                        </span>
                        {e.pendingPaise > 0 && (
                          <span className="block text-[0.6875rem] text-warning">
                            ({formatPaise(e.pendingPaise)} pending)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <RequestPayoutDialog event={e} account={data.account} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payout Request History */}
      <div className="space-y-4">
        <SectionHeading
          title="Payout History"
          description="Record of all requested, completed, and processed settlements."
        />

        {data.history.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No payout requests have been submitted yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Net Settlement</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Bank UTR / Ref</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.history.map((p) => {
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                          {p.reference}
                        </td>
                        <td className="px-4 py-3 max-w-[180px] truncate">{p.eventTitle}</td>
                        <td className="px-4 py-3 font-medium text-muted-foreground">
                          {formatPaise(p.amountPaise)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {formatPaise(p.netAmountPaise)}
                        </td>
                        <td className="px-4 py-3 capitalize text-xs">
                          {p.payoutMethod === "upi" ? "UPI" : "Bank Transfer"}
                        </td>
                        <td className="px-4 py-3">
                          {p.status === "completed" && (
                            <Badge variant="outline" className="border-success/30 bg-success-soft text-success">
                              <CheckCircle2 className="size-3" /> Completed
                            </Badge>
                          )}
                          {p.status === "requested" && (
                            <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
                              <Clock className="size-3" /> In Review
                            </Badge>
                          )}
                          {p.status === "processing" && (
                            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                              <Clock className="size-3" /> Processing
                            </Badge>
                          )}
                          {p.status === "rejected" && (
                            <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                              <XCircle className="size-3" /> Rejected
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {p.utr || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDateTime(p.createdAt)}
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
    </div>
  );
}
