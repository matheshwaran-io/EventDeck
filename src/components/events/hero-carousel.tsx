"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { EventCategory } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PosterArt } from "./poster-art";

export type HeroSlide = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  venue: string;
  category: EventCategory;
  posterPath: string | null;
  startAt: string;
  dateLabel: string;
  priceLabel: string;
  audienceLabel: string;
};

/** District-style featured carousel: details on the left, the full poster on the right. */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count, paused]);

  if (!count) return null;
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured events"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-3xl border bg-card shadow-[var(--shadow-soft)]">
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${s.title}`}
            aria-hidden={i !== index}
            inert={i !== index}
            className={cn(
              "grid gap-6 p-5 transition-opacity duration-500 sm:p-8 md:grid-cols-[1fr_minmax(0,320px)] md:items-center md:gap-10 lg:grid-cols-[1fr_minmax(0,360px)] lg:p-10",
              i === index ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0",
            )}
          >
            <div className="order-2 min-w-0 md:order-1">
              <p className="text-sm font-medium text-signal">{s.dateLabel}</p>
              <h2 className="font-display mt-2 text-[2.25rem] leading-[1.02] text-balance sm:text-[3rem]">{s.title}</h2>
              <p className="mt-3 flex items-center gap-1.5 text-[0.95rem] text-muted-foreground">
                <MapPin className="size-4 shrink-0" /> <span className="truncate">{s.venue}</span>
              </p>
              <p className="mt-4 line-clamp-2 max-w-lg text-[0.95rem] text-pretty text-muted-foreground">{s.summary}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link href={`/events/${s.slug}`} className={buttonVariants({ size: "lg" })} tabIndex={i === index ? 0 : -1}>
                  Book tickets
                </Link>
                <span className="text-sm">
                  <span className="font-semibold tabular">{s.priceLabel}</span>
                  <span className="text-muted-foreground"> · {s.audienceLabel}</span>
                </span>
              </div>
            </div>
            <Link href={`/events/${s.slug}`} className="order-1 block md:order-2" tabIndex={-1} aria-hidden>
              <PosterArt
                title={s.title}
                category={s.category}
                startAt={new Date(s.startAt)}
                posterPath={s.posterPath}
                seed={s.slug}
                size="hero"
                priority={i === 0}
                className="mx-auto aspect-[4/5] w-full max-w-[360px] rounded-2xl shadow-[var(--shadow-lift)] ring-1 ring-black/5"
              />
            </Link>
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous event" className="grid size-8 place-items-center rounded-full border bg-card hover:bg-secondary">
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show ${s.title}`}
                aria-current={i === index}
                className={cn("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25 hover:bg-foreground/50")}
              />
            ))}
          </div>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next event" className="grid size-8 place-items-center rounded-full border bg-card hover:bg-secondary">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </section>
  );
}
