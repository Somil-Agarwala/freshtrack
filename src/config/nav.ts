export type StepTone = "neutral" | "pickup" | "count" | "pile" | "factory" | "money" | "godown";

export interface StepLink {
  href: string;
  hi: string;
  en: string;
  tone: StepTone;
  /** Other paths that light this link up as the current section. */
  match: string[];
}

/** The desktop header: one link per step, coloured like the step. */
export const stepLinks: StepLink[] = [
  { href: "/", hi: "डैशबोर्ड", en: "Dashboard", tone: "neutral", match: ["/dashboard"] },
  { href: "/pickup", hi: "माल", en: "Pickup", tone: "pickup", match: ["/pickup", "/collections"] },
  { href: "/count", hi: "गिनती", en: "Count", tone: "count", match: ["/count"] },
  { href: "/piles", hi: "ढेर", en: "Piles", tone: "pile", match: ["/piles", "/sorted-bags"] },
  { href: "/send", hi: "फैक्ट्री", en: "Factory", tone: "factory", match: ["/send"] },
  { href: "/money", hi: "हिसाब", en: "Money", tone: "money", match: ["/money", "/dispatches"] },
  { href: "/godown", hi: "गोदाम", en: "Godown", tone: "godown", match: ["/godown"] },
];

export interface MoreLink {
  href: string;
  hi: string;
  en: string;
  tone?: StepTone;
}

/** Everything beyond the daily steps: records, setup and admin. */
export const moreSections: { hi: string; en: string; links: MoreLink[] }[] = [
  {
    hi: "रोज़ का काम",
    en: "Daily work",
    links: [
      { href: "/godown/new", hi: "गोदाम में माल ख़राब हुआ", en: "Log godown damage", tone: "godown" },
      { href: "/godown", hi: "गोदाम का नुकसान", en: "Godown damage", tone: "godown" },
      { href: "/money", hi: "हिसाब", en: "Factory money", tone: "money" },
    ],
  },
  {
    hi: "पूरा रिकॉर्ड",
    en: "Full records",
    links: [
      { href: "/dashboard", hi: "मालिक का डैशबोर्ड", en: "Owner dashboard" },
      { href: "/collections", hi: "सारे बैग (पिकअप)", en: "All pickup bags", tone: "pickup" },
      { href: "/sorted-bags", hi: "बँधे बैग", en: "Tied bags", tone: "pile" },
      { href: "/analytics", hi: "विस्तृत रिपोर्ट", en: "Detailed reports" },
    ],
  },
  {
    hi: "मास्टर डेटा",
    en: "Master data",
    links: [
      { href: "/master-data/companies", hi: "कंपनियाँ", en: "Companies" },
      { href: "/master-data/products", hi: "सामान", en: "Products" },
      { href: "/master-data/distributors", hi: "पार्टियाँ", en: "Parties" },
    ],
  },
  {
    hi: "एडमिन",
    en: "Admin",
    links: [
      { href: "/users", hi: "यूज़र, रोल और PIN", en: "Users, roles & PINs" },
      { href: "/settings", hi: "सेटिंग और मेरा PIN", en: "Settings & my PIN" },
    ],
  },
];

/** Focused tasks: the screen's own big button replaces the bottom menu. */
export function showsBottomNav(pathname: string) {
  const task =
    pathname.startsWith("/pickup") ||
    pathname === "/money" ||
    /^\/(count|send|collections|dispatches)\/.+/.test(pathname) ||
    pathname.startsWith("/piles/") ||
    pathname.startsWith("/godown/");
  return !task;
}
