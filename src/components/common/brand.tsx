import Link from "next/link";
import { cn } from "@/lib/utils";

/** A deck of tickets: two cards fanned behind a front ticket with a punched notch. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" fill="var(--foreground)" />
      <rect x="9.5" y="6.5" width="15" height="10" rx="2" fill="var(--background)" opacity="0.28" transform="rotate(-8 17 11.5)" />
      <rect x="8.5" y="10" width="15" height="10" rx="2" fill="var(--background)" opacity="0.55" transform="rotate(-4 16 15)" />
      <path
        d="M9 14.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1.6a1.9 1.9 0 0 0 0 3.8v1.6a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2v-1.6a1.9 1.9 0 0 0 0-3.8z"
        fill="var(--background)"
      />
      <circle cx="16.5" cy="18" r="1.9" fill="var(--signal)" />
    </svg>
  );
}

export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5 rounded-md", className)} aria-label="EventDeck home">
      <BrandMark className="transition-transform duration-300 group-hover:-rotate-6" />
      <span className="font-display text-[1.6rem] leading-none tracking-tight">
        Event<span className="italic">Deck</span>
      </span>
    </Link>
  );
}
