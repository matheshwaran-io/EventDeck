import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { checkInTicket } from "@/lib/server/checkin";
import { DomainError } from "@/lib/server/errors";
import { jsonError, readJson } from "@/lib/server/http";

const schema = z.object({ eventId: z.string().uuid(), code: z.string().min(1).max(200), method: z.enum(["qr", "manual"]) });

export async function POST(request: Request) {
  try {
    const user = await requireUser(["organizer", "admin"]);
    const parsed = schema.safeParse(await readJson(request, 2048));
    if (!parsed.success) throw new DomainError("Invalid scan.");
    const result = await checkInTicket(user, parsed.data.eventId, parsed.data.code, parsed.data.method);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
