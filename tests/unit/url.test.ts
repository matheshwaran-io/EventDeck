import { describe, expect, it } from "vitest";
import { getAppUrl, getAuthRedirectUrl, PRODUCTION_URL, safeRedirectPath } from "@/lib/url";

describe("URL resolution and auth redirect helper", () => {
  const envSnapshot = { ...process.env };

  const clearEnv = () => {
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
  };

  const setNodeEnv = (val: string | undefined) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = val;
  };

  it("always uses permanent production URL on Vercel production deployment", () => {
    clearEnv();
    process.env.VERCEL_ENV = "production";
    // Even if NEXT_PUBLIC_APP_URL was set to a preview or temporary vercel domain
    process.env.NEXT_PUBLIC_APP_URL = "https://ems-preview-abc.vercel.app";
    expect(getAppUrl()).toBe(PRODUCTION_URL);
    expect(getAuthRedirectUrl("/auth/confirm")).toBe("https://eventdeck.online/auth/confirm");
    Object.assign(process.env, envSnapshot);
  });

  it("uses permanent production URL when NEXT_PUBLIC_VERCEL_ENV is production", () => {
    clearEnv();
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    expect(getAppUrl()).toBe(PRODUCTION_URL);
    expect(getAuthRedirectUrl("/auth/confirm?next=/reset-password")).toBe(
      "https://eventdeck.online/auth/confirm?next=/reset-password"
    );
    Object.assign(process.env, envSnapshot);
  });

  it("normalizes temporary .vercel.app URLs to production URL in NODE_ENV=production", () => {
    clearEnv();
    const prevNodeEnv = process.env.NODE_ENV;
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_APP_URL = "https://ems-git-feature-vercel.app/";
    expect(getAppUrl()).toBe(PRODUCTION_URL);
    expect(getAuthRedirectUrl("auth/confirm")).toBe("https://eventdeck.online/auth/confirm");
    setNodeEnv(prevNodeEnv);
    Object.assign(process.env, envSnapshot);
  });

  it("rejects localhost in NODE_ENV=production and falls back to production URL", () => {
    clearEnv();
    const prevNodeEnv = process.env.NODE_ENV;
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(getAppUrl()).toBe(PRODUCTION_URL);
    expect(getAuthRedirectUrl("/auth/confirm")).toBe("https://eventdeck.online/auth/confirm");

    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000/";
    expect(getAppUrl()).toBe(PRODUCTION_URL);

    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(getAppUrl()).toBe(PRODUCTION_URL);
    setNodeEnv(prevNodeEnv);
    Object.assign(process.env, envSnapshot);
  });

  it("supports NEXT_PUBLIC_SITE_URL in production when set to a valid custom domain", () => {
    clearEnv();
    const prevNodeEnv = process.env.NODE_ENV;
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_SITE_URL = "https://custom.eventdeck.online";
    expect(getAppUrl()).toBe("https://custom.eventdeck.online");
    expect(getAuthRedirectUrl("/auth/confirm")).toBe("https://custom.eventdeck.online/auth/confirm");
    setNodeEnv(prevNodeEnv);
    Object.assign(process.env, envSnapshot);
  });

  it("respects custom non-vercel production domain when NODE_ENV=production", () => {
    clearEnv();
    const prevNodeEnv = process.env.NODE_ENV;
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_APP_URL = "https://custom.eventdeck.online";
    expect(getAppUrl()).toBe("https://custom.eventdeck.online");
    setNodeEnv(prevNodeEnv);
    Object.assign(process.env, envSnapshot);
  });

  it("respects local development URL and trims trailing slashes", () => {
    clearEnv();
    setNodeEnv("development");
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000/";
    expect(getAppUrl()).toBe("http://localhost:3000");
    expect(getAuthRedirectUrl("/auth/confirm")).toBe("http://localhost:3000/auth/confirm");

    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000/";
    expect(getAppUrl()).toBe("http://localhost:3000");
    expect(getAuthRedirectUrl("/auth/confirm")).toBe("http://localhost:3000/auth/confirm");
    Object.assign(process.env, envSnapshot);
  });

  it("falls back to localhost:3000 when no environment variables are set in development", () => {
    clearEnv();
    setNodeEnv("development");
    expect(getAppUrl()).toBe("http://localhost:3000");
    expect(getAuthRedirectUrl("/auth/confirm")).toBe("http://localhost:3000/auth/confirm");
    Object.assign(process.env, envSnapshot);
  });

  it("formats VERCEL_URL properly for preview deployments when outside production", () => {
    clearEnv();
    setNodeEnv("development");
    process.env.VERCEL_URL = "ems-preview-branch.vercel.app";
    expect(getAppUrl()).toBe("https://ems-preview-branch.vercel.app");
    expect(getAuthRedirectUrl("/auth/confirm")).toBe("https://ems-preview-branch.vercel.app/auth/confirm");
    Object.assign(process.env, envSnapshot);
  });
});

describe("safeRedirectPath (post-login and email-confirmation redirects)", () => {
  it("keeps same-origin paths with query and hash", () => {
    expect(safeRedirectPath("/events")).toBe("/events");
    expect(safeRedirectPath("/reset-password")).toBe("/reset-password");
    expect(safeRedirectPath("/organizer/events/abc?tab=team#x")).toBe("/organizer/events/abc?tab=team#x");
  });

  it("rejects empty, relative and absolute URLs", () => {
    for (const v of [null, undefined, "", "events", "https://evil.example", "javascript:alert(1)"]) {
      expect(safeRedirectPath(v)).toBeNull();
    }
  });

  it("rejects protocol-relative and backslash forms that resolve to another host", () => {
    for (const v of ["//evil.example", "/\\evil.example", "/\\/evil.example", "/\tevil.example", "/\r\nevil"]) {
      expect(safeRedirectPath(v)).toBeNull();
    }
  });
});
