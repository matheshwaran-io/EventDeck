"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertOctagon,
  CalendarPlus,
  CalendarRange,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  RotateCcw,
  ScrollText,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  events: CalendarRange,
  newEvent: CalendarPlus,
  users: Users,
  cancellations: XCircle,
  refunds: RotateCcw,
  exceptions: AlertOctagon,
  reports: FileSpreadsheet,
  audit: ScrollText,
  queue: ClipboardList,
} satisfies Record<string, LucideIcon>;

export type ShellLink = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; exact?: boolean };

export function DashboardShell({ title, links, children }: { title: string; links: ShellLink[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = (l: ShellLink) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`));
  // Longest matching link wins so /organizer doesn't stay highlighted on /organizer/events.
  const current = links.filter(active).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row">
      <aside className="border-b lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <p className="eyebrow hidden px-6 pt-8 pb-3 lg:block">{title}</p>
        <nav aria-label={title} className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] lg:flex-col lg:px-3 lg:py-0">
          {links.map((l) => {
            const Icon = ICONS[l.icon];
            const on = l.href === current;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {l.label}
                {l.badge ? (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 text-[0.6875rem] font-semibold tabular",
                      on ? "bg-background/15 text-background" : "bg-signal text-signal-foreground",
                    )}
                  >
                    {l.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="page-enter min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}

export function SubNav({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mt-6 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Event sections">
      {links.map((l, i) => {
        const on = i === 0 ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              on ? "border-signal text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
            {l.badge ? <span className="rounded-full bg-signal px-1.5 text-[0.6875rem] font-semibold text-signal-foreground tabular">{l.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
