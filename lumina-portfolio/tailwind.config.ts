import type { Config } from "tailwindcss";

/**
 * Ethereal Frame — design tokens exported from the source Google Stitch project
 * "모던 포토 포트폴리오" (Lumina Photography Portfolio).
 *
 * Colors, typography and spacing below are the exact values from the Stitch
 * design system theme; do not hand-tweak them — regenerate from Stitch instead.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    // Fixed 1440px design container with 64px desktop / 24px mobile framing margins.
    container: {
      center: true,
      padding: {
        DEFAULT: "24px",
        lg: "64px",
      },
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        background: "#f9f9f9",
        "on-background": "#1a1c1c",
        surface: "#f9f9f9",
        "surface-bright": "#f9f9f9",
        "surface-dim": "#dadada",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f3f3",
        "surface-container": "#eeeeee",
        "surface-container-high": "#e8e8e8",
        "surface-container-highest": "#e2e2e2",
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#444748",
        "inverse-surface": "#2f3131",
        "inverse-on-surface": "#f1f1f1",
        outline: "#747878",
        "outline-variant": "#c4c7c7",
        "surface-tint": "#5f5e5e",
        primary: "#000000",
        "on-primary": "#ffffff",
        "primary-container": "#1c1b1b",
        "on-primary-container": "#858383",
        "inverse-primary": "#c8c6c5",
        secondary: "#735c00",
        "on-secondary": "#ffffff",
        "secondary-container": "#fed65b",
        "on-secondary-container": "#745c00",
        tertiary: "#000000",
        "tertiary-container": "#0d1d2a",
        error: "#ba1a1a",
        // Semantic aliases used throughout the UI.
        charcoal: "#1a1a1a",
        gold: "#735c00",
        slate: "#708090",
      },
      fontFamily: {
        // Wired to the next/font CSS variables set in app/layout.tsx.
        display: ["var(--font-playfair)", "Playfair Display", "serif"],
        body: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["64px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-lg-mobile": ["40px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-md": ["32px", { lineHeight: "1.3", fontWeight: "600" }],
        "headline-sm": ["24px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        caption: ["14px", { lineHeight: "1.4", fontWeight: "400" }],
        "label-caps": ["12px", { lineHeight: "1", letterSpacing: "0.1em", fontWeight: "600" }],
      },
      spacing: {
        // base unit 8px; named spacing tokens from the design system.
        gutter: "32px",
        "margin-desktop": "64px",
        "margin-mobile": "24px",
        "section-gap": "128px",
      },
      maxWidth: {
        container: "1440px",
      },
      boxShadow: {
        // Ambient, highly diffused lift used only on image-card hover.
        lift: "0px 20px 40px rgba(0,0,0,0.04)",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
