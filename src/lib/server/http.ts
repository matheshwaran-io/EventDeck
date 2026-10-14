import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { DomainError } from "./errors";

const STATUS: Record<DomainError["code"], number> = {
  invalid: 400,
  not_found: 404,
  forbidden: 403,
  conflict: 409,
  sold_out: 409,
  closed: 410,
  unavailable: 503,
};

export function jsonError(err: unknown) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof DomainError) return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
  console.error("[api] unexpected error", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Reject oversized JSON bodies before parsing. */
export async function readJson(request: Request, maxBytes = 16_384): Promise<unknown> {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new DomainError("Request too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw new DomainError("Request too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("Invalid JSON body.");
  }
}
