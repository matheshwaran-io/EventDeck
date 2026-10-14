import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

export type PaymentMode = "razorpay" | "mock" | "disabled";

/** Razorpay Test Mode when keys are configured; the local simulator only when explicitly allowed outside production. */
export function paymentMode(): PaymentMode {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (keyId && process.env.RAZORPAY_KEY_SECRET) {
    if (!keyId.startsWith("rzp_test_")) {
      // Live keys are never accepted by this application.
      return "disabled";
    }
    return "razorpay";
  }
  const isProd = process.env.VERCEL_ENV === "production";
  if (process.env.ALLOW_MOCK_PAYMENTS === "true" && !isProd) return "mock";
  return "disabled";
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function hmacHex(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(
  input: { orderId: string; paymentId: string; signature: string },
  secret = process.env.RAZORPAY_KEY_SECRET ?? "",
) {
  if (!secret || !input.signature) return false;
  return safeEqualHex(hmacHex(secret, `${input.orderId}|${input.paymentId}`), input.signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook_secret). */
export function verifyWebhookSignature(rawBody: string, signature: string, secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "") {
  if (!secret || !signature) return false;
  return safeEqualHex(hmacHex(secret, rawBody), signature);
}

function authHeader() {
  const token = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(json.error?.description ?? `Razorpay request failed (${res.status})`);
  return json;
}

export async function createRazorpayOrder(input: { amountPaise: number; receipt: string; bookingId: string }) {
  return call<{ id: string; amount: number; currency: string; status: string }>("/orders", {
    amount: input.amountPaise,
    currency: "INR",
    receipt: input.receipt,
    notes: { booking_id: input.bookingId },
  });
}

export async function createRazorpayRefund(input: { paymentId: string; amountPaise: number; receipt: string }) {
  return call<{ id: string; status: "pending" | "processed" | "failed"; amount: number }>(
    `/payments/${encodeURIComponent(input.paymentId)}/refund`,
    { amount: input.amountPaise, speed: "normal", receipt: input.receipt },
  );
}
