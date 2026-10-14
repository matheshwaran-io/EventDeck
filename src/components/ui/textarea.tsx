import * as React from "react"
import { cn } from "cn"
import { fieldBase } from "./input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBase, "flex field-sizing-content min-h-24 py-2.5 leading-relaxed", className)}
      {...props}
    />
  )
}

export { Textarea }
