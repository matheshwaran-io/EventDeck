import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-display mt-3 text-[3rem] leading-none">Nothing on this page</h1>
      <p className="mt-3 text-muted-foreground">The event may have been unpublished, or the link is incomplete.</p>
      <Link href="/events" className={buttonVariants({ className: "mt-8" })}>
        Browse events
      </Link>
    </main>
  );
}
