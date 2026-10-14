import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/constants";

const tones: Record<Tone, string> = {
  neutral: "bg-secondary text-muted-foreground ring-border",
  info: "bg-info-soft text-info ring-info/15",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-[oklch(0.45_0.11_65)] ring-warning/25",
  danger: "bg-danger-soft text-destructive ring-destructive/15",
};

const dots: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", dots[tone])} />
      {children}
    </span>
  );
}
