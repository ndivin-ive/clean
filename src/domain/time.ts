import type { IsoDate } from "./types";

const DAY = 86_400_000;

/** Midnight UTC of the calendar day of `d`. */
export function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function parseIsoDate(s: IsoDate): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid ISO date: ${s}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: Date | IsoDate, to: Date | IsoDate): number {
  const a = typeof from === "string" ? parseIsoDate(from) : utcDay(from);
  const b = typeof to === "string" ? parseIsoDate(to) : utcDay(to);
  return Math.round((b - a) / DAY);
}

export function toIsoDate(d: Date): IsoDate {
  return new Date(utcDay(d)).toISOString().slice(0, 10);
}
