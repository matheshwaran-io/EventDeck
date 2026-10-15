"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

/** Horizontal, snap-scrolling row of poster cards with desktop arrow controls. */
export function PosterRail({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <div className="relative">
      <div
        ref={ref}
        role="list"
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 -right-3 -left-3 hidden items-center justify-between lg:flex" style={{ top: "-8%", bottom: "38%" }}>
        <Button variant="outline" size="icon" className="pointer-events-auto rounded-full shadow-[var(--shadow-soft)]" onClick={() => scroll(-1)} aria-label={`Scroll ${label} left`}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" className="pointer-events-auto rounded-full shadow-[var(--shadow-soft)]" onClick={() => scroll(1)} aria-label={`Scroll ${label} right`}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function RailItem({ children }: { children: React.ReactNode }) {
  return (
    <div role="listitem" className="w-[46%] shrink-0 snap-start sm:w-[30%] md:w-[23%] lg:w-[calc((100%-4rem)/5)]">
      {children}
    </div>
  );
}
