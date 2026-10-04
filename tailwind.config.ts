import type { Config } from "tailwindcss";

// Neutral surfaces resolve to CSS variables in globals.css, so the base
// theme lives in one file. The <alpha-value> placeholder keeps Tailwind
// opacity modifiers working, e.g. bg-surface/80.
function token(name: string) {
  return `rgb(var(${name}) / <alpha-value>)`;
}

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Page background. Not called "base": a colour named base makes
        // text-base (Tailwind's 16px size) also paint the text near-black.
        canvas: token("--c-base"),
        night: token("--c-base"),
        bar: token("--c-bar"),
        surface: token("--c-surface"),
        elevated: token("--c-elevated"),
        raised: token("--c-raised"),
        line: token("--c-line"),
        "line-strong": token("--c-line-strong"),
        ink: token("--c-ink"),
        "ink-soft": token("--c-ink-soft"),
        "ink-dim": token("--c-ink-dim"),
        "ink-faint": token("--c-ink-faint"),
        accent: token("--c-accent"),
        "accent-hi": token("--c-accent-hi"),
        "accent-ink": token("--c-accent-ink"),

        // One colour per step of the work, used the same way on every
        // screen: blue = pickup, yellow = count, purple = piles / tying
        // bags, orange = factory, green = money. Someone who cannot read
        // the label still knows which step they are on.
        pickup: { DEFAULT: "#5AA9FF", ink: "#0B1A2E", tint: "#13202F", soft: "#9CCBFF", note: "#CFE3FA", mute: "#8FB3D9" },
        count: { DEFAULT: "#FFC24D", ink: "#2A1E02", tint: "#3B2F12", soft: "#FFD27A", note: "#FFE3A3", mute: "#E6C77E" },
        pile: {
          DEFAULT: "#B197FC",
          ink: "#1A1238",
          tint: "#2A2347",
          deep: "#1C1830",
          fill: "#6E5BB8",
          soft: "#CDBDFF",
          mute: "#9E93C9",
          line: "#4A4170",
        },
        factory: { DEFAULT: "#FF9F5A", ink: "#2B1405", tint: "#3B2414", panel: "#2A1A0F", line: "#5C3418", soft: "#FFC79E", mute: "#D9B79C" },
        money: { DEFAULT: "#3DDC97", ink: "#08281A", tint: "#123526", line: "#1F5C43", soft: "#8FE6C4", note: "#C9F5DF", mute: "#8FD9B5" },
        danger: {
          DEFAULT: "#FF6B6B",
          icon: "#FF8A8A",
          soft: "#FF9B9B",
          note: "#FFD1D1",
          mute: "#E8A9A9",
          tint: "#3A1D20",
          card: "#2A1517",
          line: "#6B2B2F",
        },
      },
      fontFamily: {
        sans: ["var(--font-mukta)", "system-ui", "sans-serif"],
        display: ["var(--font-baloo)", "var(--font-mukta)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
