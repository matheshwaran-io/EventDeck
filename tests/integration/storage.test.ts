import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { removePoster, uploadPoster } from "@/lib/server/storage";
import { posterUrl } from "@/lib/poster";

describe("poster storage", () => {
  it("validates, compresses to WebP and stores a poster in the public bucket", async () => {
    const png = await sharp({ create: { width: 2400, height: 3000, channels: 3, background: "#d94a2a" } }).png().toBuffer();
    const file = new File([new Uint8Array(png)], "poster.png", { type: "image/png" });
    const path = await uploadPoster(file, "00000000-0000-4000-8000-000000000000");
    expect(path).toMatch(/\.webp$/);
    const res = await fetch(posterUrl(path)!);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1600);
    await removePoster(path);
  });

  it("rejects disguised and oversized files", async () => {
    const svg = new File([new TextEncoder().encode("<svg onload=alert(1)></svg>")], "x.png", { type: "image/png" });
    await expect(uploadPoster(svg, "x")).rejects.toThrow(/JPG, PNG, or WebP/);
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    await expect(uploadPoster(big, "x")).rejects.toThrow(/2 MB/);
  });
});
