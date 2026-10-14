"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getAuthedRealtimeClient } from "@/lib/supabase/client";

/** Refresh the page when this booking changes (RLS limits the feed to rows the viewer may see). */
export function BookingLiveRefresh({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void getAuthedRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const channel = supabase
        .channel(`booking:${bookingId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` }, () => router.refresh())
        .subscribe();
      cleanup = () => void supabase.removeChannel(channel);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [bookingId, router]);
  return null;
}
