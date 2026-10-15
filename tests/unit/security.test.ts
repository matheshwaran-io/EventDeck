import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { paymentMode, verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/razorpay";
import { sniffImageType } from "@/lib/server/storage";

describe("Razorpay signature verification", () => {
  const secret = "test_secret_value";
  it("accepts a correct checkout signature and rejects tampering", () => {
    const sig = createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
    expect(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: sig }, secret)).toBe(true);
    expect(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_2", signature: sig }, secret)).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: sig.slice(0, -1) + "0" }, secret)).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: "" }, secret)).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: sig }, "")).toBe(false);
  });
  it("verifies webhooks against the exact raw body", () => {
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, secret)).toBe(false);
    expect(verifyWebhookSignature(body, "", secret)).toBe(false);
  });
});

describe("payment mode guard", () => {
  const snapshot = { ...process.env };
  const reset = () => {
    for (const k of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "ALLOW_MOCK_PAYMENTS", "VERCEL_ENV"]) delete process.env[k];
  };
  it("never runs live keys and never runs the simulator in production", () => {
    reset();
    process.env.RAZORPAY_KEY_ID = "rzp_live_abc";
    process.env.RAZORPAY_KEY_SECRET = "x";
    expect(paymentMode()).toBe("disabled");
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    expect(paymentMode()).toBe("razorpay");
    reset();
    process.env.ALLOW_MOCK_PAYMENTS = "true";
    expect(paymentMode()).toBe("mock");
    process.env.VERCEL_ENV = "production";
    expect(paymentMode()).toBe("disabled");
    Object.assign(process.env, snapshot);
  });
});

describe("poster upload type sniffing", () => {
  it("trusts magic bytes, not file names", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});

describe("Root Admin permanent protection", () => {
  it("recognizes eventdeck88@gmail.com as root admin regardless of casing or whitespace", async () => {
    const { isRootAdmin, ROOT_ADMIN_EMAIL } = await import("@/lib/constants");
    expect(ROOT_ADMIN_EMAIL).toBe("eventdeck88@gmail.com");
    expect(isRootAdmin("eventdeck88@gmail.com")).toBe(true);
    expect(isRootAdmin("EVENTDECK88@GMAIL.COM")).toBe(true);
    expect(isRootAdmin("  eventdeck88@gmail.com  ")).toBe(true);
    expect(isRootAdmin("eventdeck88@srmist.edu.in")).toBe(false);
    expect(isRootAdmin("admin@eventdeck.test")).toBe(false);
    expect(isRootAdmin(null)).toBe(false);
    expect(isRootAdmin(undefined)).toBe(false);
    expect(isRootAdmin("")).toBe(false);
  });
});

