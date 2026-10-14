"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { fetchNotifications, markNotificationsRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAuthedRealtimeClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = Awaited<ReturnType<typeof fetchNotifications>>["items"][number];

export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const lastToast = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchNotifications();
      setItems(res.items);
      setUnread(res.unread);
      return res;
    } catch {
      return null;
    }
  }, []);

  // Realtime (RLS-filtered to this user) with a polling + focus fallback.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void getAuthedRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          async (payload: { new: Record<string, unknown> }) => {
            const res = await refresh();
            const n = payload.new as { id?: string; title?: string; body?: string };
            if (n?.id && lastToast.current !== n.id) {
              lastToast.current = n.id;
              toast(n.title ?? "New notification", { description: n.body });
            }
            if (res) startTransition(() => router.refresh());
          },
        )
        .subscribe((status: string) => setLive(status === "SUBSCRIBED"));
      cleanup = () => void supabase.removeChannel(channel);
    });

    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const poll = window.setInterval(() => void refresh(), 60_000);
    return () => {
      cancelled = true;
      cleanup?.();
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
    };
  }, [userId, refresh, router]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void refresh();
  };

  const markAll = async () => {
    setUnread(0);
    setItems((prev) => prev?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? prev);
    await markNotificationsRead();
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} />}
      >
        <span className="relative">
          <Bell className="size-[1.15rem]" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 text-[0.625rem] leading-none font-semibold text-signal-foreground tabular">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,380px)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Notifications</p>
            <span
              className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-muted-foreground/40")}
              title={live ? "Live updates on" : "Live updates unavailable — refreshing periodically"}
            />
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="xs" onClick={markAll}>
              <CheckCheck /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items === null ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-secondary" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
              <Inbox className="size-5" /> You&apos;re all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href ?? "/my/notifications"}
                    onClick={() => {
                      setOpen(false);
                      if (!n.readAt) void markNotificationsRead([n.id]).then(() => setUnread((u) => Math.max(0, u - 1)));
                    }}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-secondary/70"
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-signal")} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{n.title}</span>
                      {n.body && <span className="line-clamp-2 block text-[0.8125rem] text-muted-foreground">{n.body}</span>}
                      <span className="mt-1 block text-xs text-muted-foreground/80">{relativeTime(new Date(n.createdAt))}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/my/notifications" onClick={() => setOpen(false)} className="block border-t px-4 py-3 text-center text-sm font-medium hover:bg-secondary/70">
          View all
        </Link>
      </PopoverContent>
    </Popover>
  );
}
