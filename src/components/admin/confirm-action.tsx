"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Button → confirmation dialog (optionally with a note) → bound server action. */
export function ConfirmAction({
  action,
  label,
  title,
  description,
  confirmLabel,
  variant = "default",
  size = "sm",
  note,
  icon,
  disabled,
}: {
  action: (note?: string) => Promise<Result>;
  label: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  variant?: "default" | "outline" | "destructive" | "destructive-outline" | "ghost" | "signal";
  size?: "sm" | "default" | "xs";
  note?: { label: string; required?: boolean; minLength?: number; placeholder?: string };
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const min = note?.required ? (note.minLength ?? 3) : 0;

  const run = () =>
    start(async () => {
      const res = await action(note ? text.trim() : undefined);
      if (res.ok) {
        toast.success(res.message ?? "Done");
        setOpen(false);
        setText("");
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} disabled={disabled}>
        {icon}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {note && (
            <div className="space-y-1.5">
              <label className="text-[0.8125rem] font-medium" htmlFor="confirm-note">
                {note.label}
                {!note.required && <span className="font-normal text-muted-foreground"> (optional)</span>}
              </label>
              <Textarea id="confirm-note" value={text} onChange={(e) => setText(e.target.value)} placeholder={note.placeholder} maxLength={500} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant={variant === "destructive-outline" ? "destructive" : variant === "outline" || variant === "ghost" ? "default" : variant}
              onClick={run}
              disabled={pending || text.trim().length < min}
            >
              {pending && <Loader2 className="animate-spin" />} {confirmLabel ?? title}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
