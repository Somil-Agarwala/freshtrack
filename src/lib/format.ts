import type { Lang } from "./i18n";
import { today } from "./utils";

const DAY = 86_400_000;

/** Indian digit grouping: 1,94,600. */
export function num(value: number): string {
  return Math.round(value).toLocaleString("en-IN");
}

/** ₹1,94,600 */
export function inr(value: number): string {
  return `₹${num(value)}`;
}

function lakhDigits(value: number, digits: number): string {
  return (value / 100_000).toFixed(digits);
}

/** ₹4.3 लाख / ₹4.3 lakh. Below a lakh the exact amount reads better. */
export function lakh(value: number, lang: Lang = "hi", digits = 1): string {
  if (Math.abs(value) < 100_000) return inr(value);
  return `₹${lakhDigits(value, digits)} ${lang === "hi" ? "लाख" : "lakh"}`;
}

/** Compact ₹1.95L for tight spots (tiles, table cells). */
export function lakhShort(value: number, digits = 2): string {
  if (Math.abs(value) < 100_000) return inr(value);
  return `₹${lakhDigits(value, digits)}L`;
}

/** Whole days between an ISO date and today (0 = today). */
export function daysSince(dateStr: string, from = today()): number {
  return Math.max(0, Math.round((Date.parse(from) - Date.parse(dateStr)) / DAY));
}

export function daysBetween(fromStr: string, toStr: string): number {
  return Math.max(0, Math.round((Date.parse(toStr) - Date.parse(fromStr)) / DAY));
}

/*
 * Dates are spelled out by hand rather than with Intl: Node and the
 * browsers ship different Hindi spellings (अक्टूबर vs अक्तूबर), and the
 * server-rendered page must match what the phone renders.
 */
const MONTHS_HI = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const MONTHS_HI_SHORT = ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुल", "अग", "सित", "अक्टू", "नव", "दिस"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_HI = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parts(dateStr: string) {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear(), weekday: d.getUTCDay() };
}

/** शुक्रवार, 2 अक्टूबर */
export function longDate(dateStr: string, lang: Lang): string {
  const p = parts(dateStr);
  return lang === "hi" ? `${DAYS_HI[p.weekday]}, ${p.day} ${MONTHS_HI[p.month]}` : `${DAYS_EN[p.weekday]}, ${p.day} ${MONTHS_EN[p.month]}`;
}

/** 2 अक्टूबर 2026 */
export function fullDate(dateStr: string, lang: Lang): string {
  const p = parts(dateStr);
  return `${p.day} ${(lang === "hi" ? MONTHS_HI : MONTHS_EN)[p.month]} ${p.year}`;
}

/** 2 अक्टूबर */
export function dayMonth(dateStr: string, lang: Lang): string {
  const p = parts(dateStr);
  return `${p.day} ${(lang === "hi" ? MONTHS_HI : MONTHS_EN)[p.month]}`;
}

/** 14 अग */
export function shortDate(dateStr: string, lang: Lang): string {
  const p = parts(dateStr);
  return `${p.day} ${lang === "hi" ? MONTHS_HI_SHORT[p.month] : MONTHS_EN[p.month].slice(0, 3)}`;
}

export function weekdayEn(dateStr: string): string {
  return DAYS_EN[parts(dateStr).weekday];
}

/** ISO date `offset` days from `from`. */
export function addDays(dateStr: string, offset: number): string {
  return new Date(Date.parse(dateStr) + offset * DAY).toISOString().slice(0, 10);
}

/** Initials for a party tile: "Ganga Traders" -> "GT". */
export function initials(name: string): string {
  const words = name.replace(/[^A-Za-zऀ-ॿ ]/g, " ").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "?").concat(words[1]?.[0] ?? "").toUpperCase();
}
