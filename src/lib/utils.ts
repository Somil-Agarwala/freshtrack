import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

/**
 * Reads a "YYYY-MM-DD" string as that calendar day in local time.
 * `new Date("2026-01-01")` is UTC midnight, which is the previous day
 * anywhere west of UTC, so plain Date parsing is never used for these.
 */
export function parseDay(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The calendar year of a "YYYY-MM-DD" string, read straight off the text. */
export function yearOf(dateStr: string): number {
  return Number(dateStr.slice(0, 4));
}

/** A Date as "YYYY-MM-DD" in local time. */
export function toDayString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDay(dateStr));
}

/**
 * Today's date in local time. Must not use toISOString(): that is UTC, so
 * in India anything logged between midnight and 5:30 AM got yesterday's
 * date -- and on 1 January, last year's bag numbers.
 */
export function today(): string {
  return toDayString(new Date());
}

/** A unique id for a new row. Matches the uuid primary keys in Supabase. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}
