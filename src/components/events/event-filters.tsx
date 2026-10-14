"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function EventFilters({ venues }: { venues: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const advancedActive = ["from", "to", "venue", "available", "free", "audience"].some((k) => sp.get(k));
  const [showMore, setShowMore] = useState(advancedActive);
  const first = useRef(true);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  // Debounced live search.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q.trim()) update({ q: q.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const category = sp.get("category");
  const activeCount = ["category", "from", "to", "venue", "available", "free", "audience", "q"].filter((k) => sp.get(k)).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search events"
            placeholder="Search by title, venue or keyword"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 pr-9 pl-9"
          />
          {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Loading" />}
        </div>
        <Button
          variant={showMore ? "secondary" : "outline"}
          className="h-11"
          onClick={() => setShowMore((s) => !s)}
          aria-expanded={showMore}
          aria-controls="more-filters"
        >
          <SlidersHorizontal /> <span className="hidden sm:inline">Filters</span>
          {advancedActive && <span className="size-1.5 rounded-full bg-signal" />}
        </Button>
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
        <Chip active={!category} onClick={() => update({ category: null })}>
          All
        </Chip>
        {EVENT_CATEGORIES.map((c) => (
          <Chip key={c.value} active={category === c.value} onClick={() => update({ category: category === c.value ? null : c.value })}>
            {c.label}
          </Chip>
        ))}
      </div>

      {showMore && (
        <div id="more-filters" className="surface grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <label className="space-y-1.5 text-[0.8125rem] font-medium">
            Audience
            <NativeSelect value={sp.get("audience") ?? ""} onChange={(e) => update({ audience: e.target.value || null })}>
              <option value="">Any audience</option>
              <option value="srm">SRM only</option>
              <option value="intercollege">Inter-college</option>
              <option value="open">Open to all</option>
            </NativeSelect>
          </label>
          <label className="space-y-1.5 text-[0.8125rem] font-medium">
            From
            <Input type="date" value={sp.get("from") ?? ""} onChange={(e) => update({ from: e.target.value || null })} />
          </label>
          <label className="space-y-1.5 text-[0.8125rem] font-medium">
            To
            <Input type="date" value={sp.get("to") ?? ""} onChange={(e) => update({ to: e.target.value || null })} />
          </label>
          <label className="space-y-1.5 text-[0.8125rem] font-medium">
            Venue
            <NativeSelect value={sp.get("venue") ?? ""} onChange={(e) => update({ venue: e.target.value || null })}>
              <option value="">Any venue</option>
              {venues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex h-10 items-center justify-between gap-3 rounded-lg border px-3 text-sm">
            Tickets available
            <Switch checked={sp.get("available") === "1"} onCheckedChange={(v) => update({ available: v ? "1" : null })} />
          </label>
          <label className="flex h-10 items-center justify-between gap-3 rounded-lg border px-3 text-sm">
            Free entry
            <Switch checked={sp.get("free") === "1"} onCheckedChange={(v) => update({ free: v ? "1" : null })} />
          </label>
        </div>
      )}

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            startTransition(() => router.replace(pathname + (sp.get("when") ? `?when=${sp.get("when")}` : ""), { scroll: false }));
          }}
        >
          <X /> Clear filters
        </Button>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
        active ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
