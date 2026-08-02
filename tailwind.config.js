/** @type {import('tailwindcss').Config} */
import trac from "tailwindcss-react-aria-components";
import contQueries from "@tailwindcss/container-queries";

export default {
  content: ["./index.html", "./download.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        keycap: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        canvas: "rgb(var(--surface-canvas) / <alpha-value>)",
        panel: "rgb(var(--surface-panel) / <alpha-value>)",
        raised: "rgb(var(--surface-raised) / <alpha-value>)",
        ink: "rgb(var(--ink-primary) / <alpha-value>)",
        muted: "rgb(var(--ink-secondary) / <alpha-value>)",
        line: "rgb(var(--line-default) / <alpha-value>)",
        wafer: "rgb(var(--wafer-primary) / <alpha-value>)",
        "wafer-deep": "rgb(var(--wafer-deep) / <alpha-value>)",
        success: "rgb(var(--status-success) / <alpha-value>)",
        warning: "rgb(var(--status-warning) / <alpha-value>)",
        danger: "rgb(var(--status-danger) / <alpha-value>)",
        focus: "rgb(var(--focus-ring) / <alpha-value>)",

        // Compatibility aliases keep the existing ZMK components themed while
        // new Wafer surfaces use the semantic names above.
        primary: "rgb(var(--wafer-primary) / <alpha-value>)",
        "primary-content": "rgb(var(--primary-content) / <alpha-value>)",
        secondary: "rgb(var(--wafer-deep) / <alpha-value>)",
        accent: "rgb(var(--focus-ring) / <alpha-value>)",
        "base-content": "rgb(var(--ink-primary) / <alpha-value>)",
        "base-100": "rgb(var(--surface-raised) / <alpha-value>)",
        "base-200": "rgb(var(--surface-panel) / <alpha-value>)",
        "base-300": "rgb(var(--surface-canvas) / <alpha-value>)",
      },
    },
  },
  plugins: [contQueries, trac({ prefix: "rac" })],
};
