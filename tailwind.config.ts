import type { Config } from "tailwindcss";

// Every surface/text/border colour resolves to a CSS variable defined in
// globals.css. That means the whole theme lives in ONE file -- retheming
// (or adding a light mode later) is a variable change, not a find-and-
// replace across 60 components. The <alpha-value> placeholder keeps
// Tailwind opacity modifiers working, e.g. bg-accent/10.
function token(name: string) {
  return `rgb(var(${name}) / <alpha-value>)`;
}

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: token("--c-base"),
        surface: token("--c-surface"),
        elevated: token("--c-elevated"),
        raised: token("--c-raised"),
        line: token("--c-line"),
        "line-strong": token("--c-line-strong"),
        ink: token("--c-ink"),
        "ink-dim": token("--c-ink-dim"),
        "ink-faint": token("--c-ink-faint"),
        accent: token("--c-accent"),
        "accent-hi": token("--c-accent-hi"),
        "accent-ink": token("--c-accent-ink"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
