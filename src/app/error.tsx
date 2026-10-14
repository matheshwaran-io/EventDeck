"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="eyebrow">Something broke</p>
      <h1 className="font-display mt-3 text-[2.75rem] leading-none">We hit a snag</h1>
      <p className="mt-3 text-muted-foreground">This page failed to load. Your bookings and payments are safe — try again in a moment.</p>
      <Button className="mt-8" onClick={reset}>
        <RotateCcw /> Try again
      </Button>
    </main>
  );
}
