import { UNIVERSITY_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="page-enter w-full max-w-sm">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-foreground text-background lg:block" aria-hidden>
        <svg viewBox="0 0 560 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
          <g fill="none" stroke="oklch(1 0 0 / 7%)" strokeWidth="34">
            {[90, 170, 250, 330, 410, 490].map((r) => (
              <circle key={r} cx="470" cy="140" r={r} />
            ))}
          </g>
          <circle cx="470" cy="140" r="40" fill="var(--signal)" />
        </svg>
        <div className="relative flex h-full flex-col justify-end p-12">
          <p className="eyebrow text-background/50">{UNIVERSITY_NAME}</p>
          <p className="font-display mt-4 text-[3.25rem] leading-[0.98]">
            Your campus,
            <br />
            <em className="text-signal">one ticket</em> at a time.
          </p>
          <p className="mt-5 max-w-sm text-background/60">Book once, show your QR at the door, and keep every receipt and update in one place.</p>
        </div>
      </aside>
    </main>
  );
}
