import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF7F2",
        paper2: "#F2EEE6",
        ink: "#0A0A09",
        ink2: "#1C1B17",
        gold: "#CFB87C",
        gold2: "#A38C4F",
        oxblood: "#5C1A1B",
        muted: "#6B6962",
        rule: "#D9D3C5",
      },
      fontFamily: {
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3.5rem, 7vw, 6rem)", { lineHeight: "0.95", letterSpacing: "-0.04em" }],
        "display-lg": ["clamp(2.4rem, 4.5vw, 3.6rem)", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
        "stat-xl": ["clamp(2.6rem, 4.5vw, 3.8rem)", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "label": ["0.7rem", { lineHeight: "1", letterSpacing: "0.18em" }],
      },
      letterSpacing: {
        eyebrow: "0.18em",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "press-tick": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "press-tick": "press-tick 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
