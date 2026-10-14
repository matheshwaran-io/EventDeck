"use client";

import { useRouter } from "next/navigation";
import { Ban, Eye, EyeOff, Loader2, MoreHorizontal } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requestCancellationAction, setPublishedAction } from "@/app/actions/organizer";
import { adminCancelEventAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

export function EventActions({
  eventId,
  status,
  hasPendingCancellation,
  isAdmin,
}: {
  eventId: string;
  status: "draft" | "published" | "cancelled";
  hasPendingCancellation: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<"cancel" | "unpublish" | null>(null);
  const [reason, setReason] = useState("");

  if (status === "cancelled") return null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        setDialog(null);
        setReason("");
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <>
      {status === "draft" ? (
        <Button size="sm" disabled={pending} onClick={() => run(() => setPublishedAction(eventId, true))}>
          {pending ? <Loader2 className="animate-spin" /> : <Eye />} Publish
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setDialog("unpublish")}>
          <EyeOff /> Unpublish
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="More actions" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem variant="destructive" disabled={hasPendingCancellation && !isAdmin} onClick={() => setDialog("cancel")}>
            <Ban /> {isAdmin ? "Cancel event now" : hasPendingCancellation ? "Cancellation pending review" : "Request cancellation"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "unpublish"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unpublish this event?</DialogTitle>
            <DialogDescription>
              It disappears from listings and stops taking new bookings. Existing bookings and tickets are kept. You can publish again anytime.
            </DialogDescription>
          </DialogHeader>
          {isAdmin && (
            <Textarea placeholder="Note to the organizer (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Keep live
            </Button>
            <Button disabled={pending} onClick={() => run(() => setPublishedAction(eventId, false, reason))}>
              {pending && <Loader2 className="animate-spin" />} Unpublish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "cancel"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAdmin ? "Cancel this event" : "Request cancellation"}</DialogTitle>
            <DialogDescription>
              {isAdmin
                ? "This immediately cancels the event, invalidates every ticket, notifies attendees and queues refunds for paid bookings. It can't be undone."
                : "An administrator must approve. Once approved, all tickets are invalidated, attendees are notified, and paid bookings are refunded (test mode)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="cancel-reason" className="text-[0.8125rem] font-medium">
              Reason (shown to attendees)
            </label>
            <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="e.g. The guest speaker is unable to travel." />
            <p className="text-xs text-muted-foreground">{reason.trim().length < 15 ? "At least 15 characters." : " "}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Go back
            </Button>
            <Button
              variant="destructive"
              disabled={pending || reason.trim().length < 15}
              onClick={() => run(() => (isAdmin ? adminCancelEventAction(eventId, reason) : requestCancellationAction(eventId, reason)))}
            >
              {pending && <Loader2 className="animate-spin" />} {isAdmin ? "Cancel event" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
