import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

export function randomCode(length: number) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export const bookingReference = () => `BK-${randomCode(8)}`;
export const ticketNumber = (eventCode: string) => `${eventCode}-${randomCode(4)}-${randomCode(4)}`;

/** 192 bits of randomness; the only thing a QR code ever carries. */
export const qrToken = () => randomBytes(24).toString("base64url");

export const QR_PREFIX = "EVD1:";
export const qrPayload = (token: string) => `${QR_PREFIX}${token}`;

/** Accepts a scanned payload, a raw token, or a typed ticket number. */
export function parseScan(raw: string): { kind: "token"; value: string } | { kind: "number"; value: string } | null {
  const v = raw.trim();
  if (!v || v.length > 200) return null;
  if (v.startsWith(QR_PREFIX)) {
    const token = v.slice(QR_PREFIX.length);
    return /^[A-Za-z0-9_-]{32}$/.test(token) ? { kind: "token", value: token } : null;
  }
  if (/^[A-Za-z0-9_-]{32}$/.test(v)) return { kind: "token", value: v };
  const upper = v.toUpperCase();
  if (/^[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(upper)) return { kind: "number", value: upper };
  return null;
}

export function eventCode(title: string) {
  const letters = title
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("");
  return (letters || "EVT").slice(0, 4).padEnd(3, "X");
}

export function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${base || "event"}-${randomCode(5).toLowerCase()}`;
}
