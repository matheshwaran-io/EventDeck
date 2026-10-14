import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/server/errors";
import { jsonError, readJson } from "@/lib/server/http";
import { createOrderForBooking } from "@/lib/server/payments";

const schema = z.object({ bookingId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new DomainError("Invalid booking.");
    const order = await createOrderForBooking(user, parsed.data.bookingId);
    return NextResponse.json(order);
  } catch (err) {
    return jsonError(err);
  }
}
