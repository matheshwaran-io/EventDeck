import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { Event, Ticket } from "@/db/schema";
import { APP_NAME, UNIVERSITY_NAME } from "@/lib/constants";
import { formatDate, formatPaise, formatTime } from "@/lib/format";
import { qrPayload } from "@/lib/domain/tokens";

const INK = rgb(0.09, 0.08, 0.07);
const PAPER = rgb(0.98, 0.97, 0.95);
const MUTED = rgb(0.42, 0.4, 0.37);
const ACCENT = rgb(0.84, 0.29, 0.16);
const RULE = rgb(0.86, 0.84, 0.8);

/** Standard PDF fonts are WinAnsi only — strip anything else rather than crash. */
function safe(text: string) {
  return text
    .replace(/₹/g, "INR ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number) {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/\s+\S*$/, "")}...`;
    return kept;
  }
  return lines;
}

function label(page: PDFPage, font: PDFFont, text: string, x: number, y: number) {
  page.drawText(safe(text).toUpperCase(), { x, y, size: 7, font, color: MUTED });
}

export type PdfTicket = Ticket & { tierName: string; tierPricePaise: number };

export async function renderTicketsPdf(event: Event, booking: { reference: string }, list: PdfTicket[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(safe(`${event.title} - Tickets ${booking.reference}`));
  pdf.setAuthor(APP_NAME);
  pdf.setProducer(APP_NAME);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 420;
  const H = 640;
  const M = 32;

  for (const [i, t] of list.entries()) {
    const page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });

    // Header band
    page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: INK });
    page.drawRectangle({ x: 0, y: H - 96, width: W, height: 4, color: ACCENT });
    page.drawText(APP_NAME.toUpperCase(), { x: M, y: H - 40, size: 13, font: bold, color: PAPER });
    page.drawText(safe(UNIVERSITY_NAME), { x: M, y: H - 56, size: 8, font: regular, color: rgb(0.75, 0.73, 0.7) });
    const admit = `ADMIT ONE  ·  ${i + 1} OF ${list.length}`.replace("·", "-");
    page.drawText(admit, { x: W - M - bold.widthOfTextAtSize(admit, 8), y: H - 40, size: 8, font: bold, color: PAPER });
    const tier = safe(t.tierName.toUpperCase());
    page.drawText(tier, { x: W - M - bold.widthOfTextAtSize(tier, 11), y: H - 58, size: 11, font: bold, color: ACCENT });

    // Title
    let y = H - 132;
    for (const line of wrap(event.title, bold, 22, W - 2 * M, 3)) {
      page.drawText(line, { x: M, y, size: 22, font: bold, color: INK });
      y -= 26;
    }

    // Details grid
    y -= 8;
    label(page, regular, "Date", M, y);
    label(page, regular, "Time", M + 190, y);
    y -= 15;
    page.drawText(safe(formatDate(event.startAt)), { x: M, y, size: 11, font: bold, color: INK });
    page.drawText(safe(`${formatTime(event.startAt)} - ${formatTime(event.endAt)}`), { x: M + 190, y, size: 11, font: bold, color: INK });
    y -= 24;
    label(page, regular, "Venue", M, y);
    y -= 15;
    for (const line of wrap(event.venue, bold, 11, W - 2 * M, 2)) {
      page.drawText(line, { x: M, y, size: 11, font: bold, color: INK });
      y -= 14;
    }

    // Perforation
    y -= 10;
    for (let x = M; x < W - M; x += 8) page.drawLine({ start: { x, y }, end: { x: x + 4, y }, thickness: 0.8, color: RULE });
    page.drawCircle({ x: 0, y, size: 10, color: rgb(1, 1, 1) });
    page.drawCircle({ x: W, y, size: 10, color: rgb(1, 1, 1) });

    // QR + stub
    const qrPng = await QRCode.toBuffer(qrPayload(t.qrToken), { errorCorrectionLevel: "M", margin: 1, width: 360 });
    const img = await pdf.embedPng(qrPng);
    const qrSize = 168;
    const qrY = y - 24 - qrSize;
    page.drawRectangle({ x: M - 6, y: qrY - 6, width: qrSize + 12, height: qrSize + 12, color: rgb(1, 1, 1), borderColor: RULE, borderWidth: 0.8 });
    page.drawImage(img, { x: M, y: qrY, width: qrSize, height: qrSize });

    const sx = M + qrSize + 24;
    let sy = y - 34;
    label(page, regular, "Attendee", sx, sy);
    sy -= 15;
    for (const line of wrap(t.attendeeName, bold, 12, W - sx - M, 2)) {
      page.drawText(line, { x: sx, y: sy, size: 12, font: bold, color: INK });
      sy -= 15;
    }
    sy -= 8;
    label(page, regular, "Ticket no.", sx, sy);
    sy -= 14;
    page.drawText(t.ticketNumber, { x: sx, y: sy, size: 10, font: bold, color: INK });
    sy -= 22;
    label(page, regular, "Booking", sx, sy);
    sy -= 14;
    page.drawText(booking.reference, { x: sx, y: sy, size: 10, font: regular, color: INK });
    sy -= 22;
    label(page, regular, "Price", sx, sy);
    sy -= 14;
    page.drawText(safe(formatPaise(t.tierPricePaise)), { x: sx, y: sy, size: 10, font: regular, color: INK });

    // Status pill
    const status = t.status === "valid" ? "VALID" : "VOID";
    const pillW = bold.widthOfTextAtSize(status, 8) + 16;
    page.drawRectangle({ x: sx, y: qrY - 2, width: pillW, height: 16, color: t.status === "valid" ? rgb(0.13, 0.45, 0.29) : ACCENT });
    page.drawText(status, { x: sx + 8, y: qrY + 3, size: 8, font: bold, color: rgb(1, 1, 1) });

    // Footer instructions
    const notes = [
      "Show this QR code at the entrance. Each code admits one person once.",
      "Validity is checked live at the door - a copied or cancelled ticket will be refused.",
      "Check-in opens " + safe(`${formatDate(event.checkinOpensAt)}, ${formatTime(event.checkinOpensAt)}.`),
    ];
    let fy = 70;
    page.drawLine({ start: { x: M, y: fy + 18 }, end: { x: W - M, y: fy + 18 }, thickness: 0.6, color: RULE });
    for (const n of notes) {
      page.drawText(safe(n), { x: M, y: fy, size: 7.5, font: regular, color: MUTED });
      fy -= 12;
    }
  }

  return pdf.save();
}
