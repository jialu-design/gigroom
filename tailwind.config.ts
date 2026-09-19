import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#080A09",
          secondary: "#111413",
          tertiary: "#1A1E1D",
          elevated: "#222725",
        },
        text: {
          primary: "#F3F5F1",
          secondary: "#B5BAB5",
          tertiary: "#858B86",
          inverse: "#080A09",
        },
        accent: {
          red: "#C8414B",
          "red-hover": "#D9555F",
          "red-muted": "#8B2E36",
          green: "#3D6B4F",
          "green-hover": "#4A7E5E",
          blue: "#4A6B8A",
          "blue-hover": "#5A7FA0",
          yellow: "#C9A24A",
          lime: "#B7F34A",
          "lime-hover": "#C8F566",
          "lime-muted": "#8FB62E",
        },
        border: {
          DEFAULT: "#333333",
          light: "#444444",
          strong: "#555555",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "Noto Sans SC",
          "sans-serif",
        ],
        condensed: [
          "var(--font-condensed)",
          "Barlow Condensed",
          "Inter",
          "-apple-system",
          "Segoe UI",
          "PingFang SC",
          "Noto Sans SC",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "Monaco",
          "Inconsolata",
          "Fira Code",
          "monospace",
        ],
      },
      fontSize: {
        hero: [
          "64px",
          {
            lineHeight: "1.05",
            letterSpacing: "-0.02em",
            fontWeight: "800",
          },
        ],
        "hero-mobile": [
          "40px",
          {
            lineHeight: "1.1",
            letterSpacing: "-0.01em",
            fontWeight: "800",
          },
        ],
        h1: [
          "36px",
          {
            lineHeight: "1.2",
            letterSpacing: "-0.01em",
            fontWeight: "700",
          },
        ],
        h2: [
          "28px",
          {
            lineHeight: "1.25",
            letterSpacing: "-0.01em",
            fontWeight: "700",
          },
        ],
        h3: [
          "22px",
          {
            lineHeight: "1.3",
            fontWeight: "600",
          },
        ],
        lg: [
          "18px",
          {
            lineHeight: "1.5",
            fontWeight: "500",
          },
        ],
        body: [
          "15px",
          {
            lineHeight: "1.6",
            fontWeight: "400",
          },
        ],
        sm: [
          "13px",
          {
            lineHeight: "1.5",
            fontWeight: "400",
          },
        ],
        xs: [
          "11px",
          {
            lineHeight: "1.5",
            fontWeight: "400",
          },
        ],
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
      },
      borderRadius: {
        sm: "2px",
        md: "4px",
        lg: "8px",
      },
      letterSpacing: {
        tighter: "-0.02em",
        tight: "-0.01em",
      },
      transitionTimingFunction: {
        "zine": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.25s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
