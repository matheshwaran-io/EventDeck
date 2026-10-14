import { NextResponse } from "next/server";
import { expireHolds } from "@/lib/server/bookings";

/**
 * Lightweight sweep for lapsed reservations. Expiry also runs lazily whenever
 * an event, booking or dashboard is read, so this is only a safety net.
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await expireHolds();
  return NextResponse.json({ expired });
}
