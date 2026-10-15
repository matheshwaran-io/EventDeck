export const PRODUCTION_URL = "https://eventdeck.online";

function isLocalhost(url: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(url);
}

/**
 * Resolves the canonical base URL for the application.
 *
 * Rules:
 * 1. In Vercel production deployment (`VERCEL_ENV === "production"` or `NEXT_PUBLIC_VERCEL_ENV === "production"`),
 *    always use the canonical permanent production URL: https://eventdeck.online.
 * 2. If running in production mode (`NODE_ENV === "production"`):
 *    - Check NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL.
 *    - If set to localhost/127.0.0.1 or a temporary *.vercel.app domain, ignore it and default to https://eventdeck.online.
 *    - Otherwise, if a custom valid domain is provided, use it (trimmed without trailing slashes).
 *    - Fallback to https://eventdeck.online.
 * 3. In non-production environments (local development, preview, tests):
 *    - If NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL is explicitly set, use it (trimmed without trailing slashes).
 *    - If VERCEL_URL is present, format as https://${VERCEL_URL}.
 *    - Fallback to http://localhost:3000.
 */
export function getAppUrl(): string {
  if (process.env.VERCEL_ENV === "production" || process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
    return PRODUCTION_URL;
  }

  const configured = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL)?.trim();

  if (process.env.NODE_ENV === "production") {
    if (configured && !configured.includes("vercel.app") && !isLocalhost(configured)) {
      return configured.replace(/\/+$/, "");
    }
    return PRODUCTION_URL;
  }

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

/**
 * Returns the absolute URL for an auth redirect destination.
 * Example: getAuthRedirectUrl("/auth/confirm") -> "https://eventdeck.online/auth/confirm"
 */
export function getAuthRedirectUrl(path = "/auth/confirm"): string {
  const base = getAppUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * Returns `next` only if it is a same-origin path ("/events?x=1"), otherwise null.
 * Rejects protocol-relative and backslash forms ("//evil.com", "/\evil.com") that
 * browsers and the URL parser treat as another host, plus control characters.
 */
export function safeRedirectPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return null;
  const base = "http://eventdeck.invalid";
  const resolved = new URL(next, base);
  return resolved.origin === base ? `${resolved.pathname}${resolved.search}${resolved.hash}` : null;
}
