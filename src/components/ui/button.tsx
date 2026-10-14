import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_1px_0_0_oklch(1_0_0/12%)_inset] hover:bg-primary/88",
        signal: "bg-signal text-signal-foreground hover:bg-signal/90",
        outline: "border-border bg-card hover:border-foreground/25 hover:bg-secondary aria-expanded:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "hover:bg-secondary aria-expanded:bg-secondary",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        "destructive-outline": "border-destructive/30 bg-card text-destructive hover:bg-danger-soft",
        link: "h-auto px-0 text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-7 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 px-6 text-[0.9375rem]",
        icon: "size-10",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
