import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { MAX_POSTER_BYTES } from "@/lib/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DomainError } from "./errors";

export function sniffImageType(buf: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return "image/png";
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

/** Validate (type by magic bytes, ≤ 2 MB), compress to WebP ≤ 1600px, and upload. Returns the storage path. */
export async function uploadPoster(file: File, eventId: string): Promise<string> {
  if (file.size === 0) throw new DomainError("The poster file is empty.");
  if (file.size > MAX_POSTER_BYTES) throw new DomainError("Posters must be 2 MB or smaller.");
  const input = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(input);
  if (!type) throw new DomainError("Posters must be JPG, PNG, or WebP images.");

  let output: Buffer;
  try {
    output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new DomainError("That image couldn't be read. Try a different file.");
  }

  const path = `${eventId}/${Date.now()}-${randomBytes(4).toString("hex")}.webp`;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from("posters").upload(path, output, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error("[storage] poster upload failed", error.message);
    throw new DomainError("Poster upload failed. Please try again.", "unavailable");
  }
  return path;
}

export async function removePoster(path: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.storage.from("posters").remove([path]);
}

/** Private ticket-PDF cache. Reads/writes only via the service role behind an authorised route. */
export async function readTicketPdf(path: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from("tickets").download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function writeTicketPdf(path: string, bytes: Uint8Array) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from("tickets")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) console.warn("[storage] ticket pdf cache write failed", error.message);
}

export async function removeTicketPdf(path: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.storage.from("tickets").remove([path]);
}
