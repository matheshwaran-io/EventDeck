import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Plain anchor for file downloads served by route handlers (not page navigation). */
export function DownloadLink({ href, children, size = "sm", variant = "outline" }: { href: string; children: React.ReactNode; size?: "sm" | "default"; variant?: "outline" | "default" }) {
  return (
    <a href={href} download className={buttonVariants({ variant, size })}>
      <Download /> {children}
    </a>
  );
}
