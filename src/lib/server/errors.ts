export class DomainError extends Error {
  constructor(
    message: string,
    public code:
      | "invalid"
      | "not_found"
      | "forbidden"
      | "conflict"
      | "sold_out"
      | "closed"
      | "unavailable" = "invalid",
  ) {
    super(message);
  }
}

export function pgErrorCode(err: unknown): { code?: string; constraint?: string } {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    const anyE = e as { code?: string; constraint_name?: string; cause?: unknown };
    if (typeof anyE.code === "string" && /^\d{5}$|^[0-9A-Z]{5}$/.test(anyE.code)) {
      return { code: anyE.code, constraint: anyE.constraint_name };
    }
    e = anyE.cause;
  }
  return {};
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Map any thrown error to a user-safe message without leaking internals. */
export function toActionError(err: unknown): { ok: false; error: string } {
  if (err instanceof DomainError) return { ok: false, error: err.message };
  if (err && typeof err === "object" && "status" in err && err instanceof Error) {
    return { ok: false, error: err.message };
  }
  console.error("[action] unexpected error", err instanceof Error ? err.message : err);
  return { ok: false, error: "Something went wrong. Please try again." };
}
