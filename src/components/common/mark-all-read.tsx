"use client";

import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { markNotificationsRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markNotificationsRead();
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all read
    </Button>
  );
}
