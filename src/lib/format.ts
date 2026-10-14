import { APP_TIMEZONE, APP_TZ_OFFSET } from "./constants";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

/** Money totals (revenue, refunds): always a currency amount, never "Free". */
export function formatInr(paise: number) {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? inr.format(rupees).replace(/\.00$/, "") : inr.format(rupees);
}

/** Prices: zero reads as "Free". */
export function formatPaise(paise: number) {
  if (paise === 0) return "Free";
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? inr.format(rupees).replace(/\.00$/, "") : inr.format(rupees);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, ...opts });

const dateFmt = fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = fmt({ day: "numeric", month: "short" });
const timeFmt = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const dateTimeFmt = fmt({ day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
const monthFmt = fmt({ month: "short" });
const dayFmt = fmt({ day: "2-digit" });

export const formatDate = (d: Date) => dateFmt.format(d);
export const formatShortDate = (d: Date) => shortDateFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d).toUpperCase();
export const formatDateTime = (d: Date) => dateTimeFmt.format(d).replace(/am|pm/, (m) => m.toUpperCase());
export const formatMonth = (d: Date) => monthFmt.format(d).toUpperCase();
export const formatDay = (d: Date) => dayFmt.format(d);

export function formatRange(start: Date, end: Date) {
  const sameDay = shortDateFmt.format(start) === shortDateFmt.format(end);
  return sameDay
    ? `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`
    : `${formatDateTime(start)} – ${formatDateTime(end)}`;
}

/** Convert a `datetime-local` value (interpreted in campus time) to a Date. */
export function fromLocalInput(value: string): Date {
  return new Date(`${value.length === 16 ? `${value}:00` : value}${APP_TZ_OFFSET}`);
}

/** Render a Date as a `datetime-local` value in campus time. */
export function toLocalInput(d: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function relativeTime(d: Date, now = new Date()) {
  const diff = (d.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatShortDate(d);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
