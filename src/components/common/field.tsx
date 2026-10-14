import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)} data-invalid={Boolean(error) || undefined}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-[0.8125rem] font-medium">
        {label}
        {required && <span className="text-signal" aria-hidden>*</span>}
      </label>
      <div aria-describedby={describedBy}>{children}</div>
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
