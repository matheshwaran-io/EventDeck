import Link from "next/link";
import { BrandMark } from "@/components/common/brand";
import { UNIVERSITY_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <BrandMark className="size-6" />
          <p>
            EventDeck · Events at {UNIVERSITY_NAME}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
          <Link href="/events" className="hover:text-foreground">Browse events</Link>
          <Link href="/my/bookings" className="hover:text-foreground">My tickets</Link>
          <Link href="/my/profile" className="hover:text-foreground">Host an event</Link>
        </nav>
        <p className="text-xs">Payments run in Razorpay Test Mode. No real money is charged.</p>
      </div>
    </footer>
  );
}
