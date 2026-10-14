import type { EventCategory } from "@/db/schema";
import { categoryLabel } from "@/lib/constants";
import { formatDay, formatMonth } from "@/lib/format";
import { posterUrl } from "@/lib/poster";
import { cn } from "@/lib/utils";

const palettes: Record<EventCategory, { bg: string; fg: string; accent: string; soft: string }> = {
  technical: { bg: "oklch(0.29 0.055 258)", fg: "oklch(0.97 0.01 85)", accent: "oklch(0.72 0.15 45)", soft: "oklch(0.38 0.06 258)" },
  cultural: { bg: "oklch(0.6 0.19 34)", fg: "oklch(0.98 0.01 85)", accent: "oklch(0.2 0.02 50)", soft: "oklch(0.66 0.17 38)" },
  academic: { bg: "oklch(0.34 0.055 162)", fg: "oklch(0.97 0.012 90)", accent: "oklch(0.85 0.1 95)", soft: "oklch(0.42 0.06 162)" },
  workshop: { bg: "oklch(0.8 0.12 82)", fg: "oklch(0.22 0.02 60)", accent: "oklch(0.55 0.18 34)", soft: "oklch(0.74 0.12 80)" },
  sports: { bg: "oklch(0.2 0.012 60)", fg: "oklch(0.97 0.01 85)", accent: "oklch(0.64 0.19 34)", soft: "oklch(0.3 0.012 60)" },
  career: { bg: "oklch(0.35 0.07 320)", fg: "oklch(0.97 0.01 85)", accent: "oklch(0.82 0.09 75)", soft: "oklch(0.43 0.07 320)" },
  social: { bg: "oklch(0.87 0.06 45)", fg: "oklch(0.24 0.03 40)", accent: "oklch(0.52 0.16 30)", soft: "oklch(0.82 0.07 45)" },
  other: { bg: "oklch(0.9 0.01 80)", fg: "oklch(0.22 0.015 60)", accent: "oklch(0.6 0.19 34)", soft: "oklch(0.84 0.012 80)" },
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function Pattern({ variant, soft, accent }: { variant: number; soft: string; accent: string }) {
  switch (variant) {
    case 0:
      return (
        <g fill="none" stroke={soft} strokeWidth="14">
          {[60, 110, 160, 210, 260].map((r) => (
            <circle key={r} cx="360" cy="190" r={r} />
          ))}
          <circle cx="360" cy="190" r="24" fill={accent} stroke="none" />
        </g>
      );
    case 1:
      return (
        <g>
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x={-200 + i * 44} y="-50" width="18" height="600" fill={soft} transform="rotate(-28 200 200)" />
          ))}
          <rect x="296" y="132" width="52" height="52" fill={accent} />
        </g>
      );
    case 2:
      return (
        <g fill={soft}>
          {Array.from({ length: 9 }, (_, r) =>
            Array.from({ length: 9 }, (_, c) => <circle key={`${r}-${c}`} cx={40 + c * 42} cy={30 + r * 42} r={r === 3 && c === 6 ? 16 : 5} fill={r === 3 && c === 6 ? accent : soft} />),
          )}
        </g>
      );
    default:
      return (
        <g>
          <path d="M-20 260 Q 120 120 240 210 T 440 140" fill="none" stroke={soft} strokeWidth="38" strokeLinecap="round" />
          <path d="M-20 320 Q 120 180 240 270 T 440 200" fill="none" stroke={soft} strokeWidth="38" strokeLinecap="round" opacity="0.6" />
          <circle cx="330" cy="150" r="28" fill={accent} />
        </g>
      );
  }
}

/** Uploaded poster when present; otherwise a deterministic typographic poster. */
export function PosterArt({
  title,
  category,
  startAt,
  posterPath,
  seed,
  className,
  size = "card",
  priority,
}: {
  title: string;
  category: EventCategory;
  startAt: Date;
  posterPath?: string | null;
  seed: string;
  className?: string;
  size?: "card" | "hero" | "thumb";
  priority?: boolean;
}) {
  const url = posterUrl(posterPath);
  if (url) {
    return (
      <div className={cn("relative overflow-hidden bg-secondary", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- compressed WebP from storage */}
        <img
          src={url}
          alt={`Poster for ${title}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    );
  }
  const p = palettes[category];
  const variant = hash(seed) % 4;
  return (
    <div className={cn("@container relative overflow-hidden", className)} style={{ background: p.bg, color: p.fg }} role="img" aria-label={`${categoryLabel(category)} event artwork for ${title}`}>
      <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        <Pattern variant={variant} soft={p.soft} accent={p.accent} />
      </svg>
      {size !== "thumb" && (
        <div className={cn("absolute inset-0 flex flex-col justify-between", size === "hero" ? "p-[7cqi]" : "p-4")}>
          <div className="flex items-start justify-between font-mono text-[0.625rem] tracking-[0.18em] uppercase opacity-80">
            <span>{categoryLabel(category)}</span>
            <span className="text-right leading-tight">
              <span className="block text-[1.5rem] font-medium tracking-tight">{formatDay(startAt)}</span>
              {formatMonth(startAt)}
            </span>
          </div>
          <p
            className={cn(
              "font-display leading-[0.95] text-balance",
              size === "hero" ? "line-clamp-5 text-[clamp(1.5rem,11.5cqi,3.75rem)]" : "line-clamp-3 text-[clamp(1.25rem,9cqi,1.9rem)]",
            )}
          >
            {title}
          </p>
        </div>
      )}
    </div>
  );
}
