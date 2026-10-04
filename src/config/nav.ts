export type StepTone = "neutral" | "pickup" | "count" | "pile" | "factory" | "money";

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
  { href: "/pickup", hi: "माल", en: "Pickup", tone: "pickup", match: ["/pickup"] },
  { href: "/count", hi: "गिनती", en: "Count", tone: "count", match: ["/count"] },
  { href: "/piles", hi: "ढेर", en: "Piles", tone: "pile", match: ["/piles"] },
  { href: "/send", hi: "फैक्ट्री", en: "Factory", tone: "factory", match: ["/send"] },
  { href: "/money", hi: "हिसाब", en: "Money", tone: "money", match: ["/money"] },
];

export interface MoreLink {
  href: string;
  hi: string;
  en: string;
}

/** Everything that is not a daily step: full records, setup and admin. */
export const moreSections: { hi: string; en: string; links: MoreLink[] }[] = [
  {
    hi: "पूरा रिकॉर्ड",
    en: "Full records",
    links: [
      { href: "/dashboard", hi: "मालिक का डैशबोर्ड", en: "Owner dashboard" },
      { href: "/collections", hi: "सारे बैग (पिकअप)", en: "All pickup bags" },
      { href: "/sorted-bags", hi: "बँधे बैग", en: "Tied bags" },
      { href: "/dispatches", hi: "सारी गाड़ियाँ", en: "All dispatches" },
      { href: "/analytics", hi: "विस्तृत रिपोर्ट", en: "Detailed reports" },
    ],
  },
  {
    hi: "अपना स्टॉक",
    en: "Own inventory",
    links: [
      { href: "/new-entry", hi: "नई एंट्री", en: "New entry" },
      { href: "/records", hi: "सारी एंट्री", en: "All entries" },
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
      { href: "/users", hi: "यूज़र और रोल", en: "Users & roles" },
      { href: "/settings", hi: "सेटिंग", en: "Settings" },
    ],
  },
];

/** Screens of the redesigned flow; everything else is a records/admin page. */
const FLOW_PREFIXES = ["/pickup", "/count", "/piles", "/send", "/money", "/dashboard"];

export function isFlowPath(pathname: string) {
  return pathname === "/" || FLOW_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Phone screens that show the bottom menu (the rest are focused tasks). */
export function showsBottomNav(pathname: string) {
  return ["/", "/count", "/piles", "/send", "/dashboard"].includes(pathname) || !isFlowPath(pathname);
}

export function titleFor(pathname: string): MoreLink | undefined {
  return moreSections
    .flatMap((s) => s.links)
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
