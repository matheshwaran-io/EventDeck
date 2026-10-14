import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground ring-8 ring-secondary/50">
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
