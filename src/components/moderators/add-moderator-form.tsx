"use client";

import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addModeratorAction } from "@/app/actions/moderators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddModeratorForm({ eventId, disabled }: { eventId: string; disabled?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const value = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("Enter the email address they signed up with.");
        setError(null);
        start(async () => {
          const res = await addModeratorAction(eventId, value);
          if (res.ok) {
            toast.success(res.message);
            setEmail("");
            router.refresh();
          } else setError(res.error);
        });
      }}
    >
      <label htmlFor="moderator-email" className="text-[0.8125rem] font-medium">
        Moderator&apos;s account email
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="moderator-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="friend@srmist.edu.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error)}
          disabled={disabled || pending}
        />
        <Button type="submit" disabled={disabled || pending} className="shrink-0">
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Add moderator
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">They need an EventDeck account. Moderators can only scan tickets for this event — nothing else.</p>
      )}
    </form>
  );
}
