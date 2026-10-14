import { notFound } from "next/navigation";
import { ShieldCheck, UserMinus, UsersRound } from "lucide-react";
import { revokeModeratorAction } from "@/app/actions/moderators";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { AddModeratorForm } from "@/components/moderators/add-moderator-form";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getManagedEvent } from "@/lib/server/events";
import { listModerators, MAX_MODERATORS_PER_EVENT } from "@/lib/server/moderators";

export default async function TeamPage({ params }: PageProps<"/organizer/events/[id]/team">) {
  const { id } = await params;
  const user = await requirePageUser(["organizer", "admin"]);
  const data = await getManagedEvent(user, id);
  if (!data) notFound();
  const rows = await listModerators(user, id);
  const active = rows.filter((r) => !r.moderator.revokedAt);
  const cancelled = data.event.status === "cancelled";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Check-in moderators</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {active.length} of {MAX_MODERATORS_PER_EVENT} active. Every scan is attributed to the person who made it.
            </p>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={UsersRound} title="No moderators yet" description="Add trusted teammates so they can scan tickets at the door from their own phones." />
        ) : (
          <ul className="surface divide-y">
            {rows.map((r) => (
              <li key={r.moderator.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{r.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Added {formatDateTime(r.moderator.createdAt)} · {r.scans} check-in{r.scans === 1 ? "" : "s"}
                    {r.moderator.revokedAt ? ` · removed ${formatDateTime(r.moderator.revokedAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.moderator.revokedAt ? (
                    <StatusBadge tone="neutral">Removed</StatusBadge>
                  ) : !r.isActive ? (
                    <StatusBadge tone="warning">Account deactivated</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Active</StatusBadge>
                  )}
                  {!r.moderator.revokedAt && (
                    <ConfirmAction
                      action={revokeModeratorAction.bind(null, id, r.moderator.id)}
                      variant="destructive-outline"
                      size="xs"
                      icon={<UserMinus />}
                      label="Remove"
                      title={`Remove ${r.name}?`}
                      confirmLabel="Remove access"
                      description="Their access ends immediately — the next ticket they scan will be refused. Check-ins they already made are kept."
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="space-y-4">
        <div className="surface p-5">
          <AddModeratorForm eventId={id} disabled={cancelled || active.length >= MAX_MODERATORS_PER_EVENT} />
        </div>
        <div className="rounded-xl bg-secondary p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4 text-success" /> What moderators can do
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Open the scanner for this event from their own account (Check-in in the menu).</li>
            <li>See the attendee name, tier and ticket number of each ticket they scan.</li>
            <li>Nothing else: no editing, bookings, payments, reports or other events.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
