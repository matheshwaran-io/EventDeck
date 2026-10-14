import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <ShieldAlert className="size-8 text-signal" />
      <h1 className="font-display mt-4 text-[2.5rem] leading-none">Not for this account</h1>
      <p className="mt-3 text-muted-foreground">You&apos;re signed in, but your role doesn&apos;t have access to that page.</p>
      <Link href="/" className={buttonVariants({ className: "mt-8" })}>
        Back to events
      </Link>
    </div>
  );
}
