import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  emphasis,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("surface flex flex-col justify-between gap-6 p-4 sm:p-5", emphasis && "bg-foreground text-background", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("eyebrow", emphasis && "text-background/60")}>{label}</p>
        {Icon && <Icon className={cn("size-4 text-muted-foreground", emphasis && "text-signal")} strokeWidth={1.75} />}
      </div>
      <div>
        <p className="tabular text-[1.75rem] leading-none font-semibold tracking-tight sm:text-[2rem]">{value}</p>
        {hint && <p className={cn("mt-2 text-xs text-muted-foreground", emphasis && "text-background/60")}>{hint}</p>}
      </div>
    </div>
  );
}
