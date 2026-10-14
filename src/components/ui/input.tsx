import * as React from "react"
import { cn } from "cn"

const fieldBase =
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base shadow-[0_1px_0_0_oklch(0.2_0.01_60/3%)] transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-signal focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 md:text-sm"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBase,
        "h-10 file:mr-3 file:inline-flex file:h-7 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:text-sm file:font-medium file:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(fieldBase, "h-10 appearance-none pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export { Input, NativeSelect, fieldBase }
