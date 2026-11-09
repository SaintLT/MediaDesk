/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        charcoal: {
          950: "rgb(var(--charcoal-950) / <alpha-value>)",
          900: "rgb(var(--charcoal-900) / <alpha-value>)",
          800: "rgb(var(--charcoal-800) / <alpha-value>)",
          700: "rgb(var(--charcoal-700) / <alpha-value>)",
          600: "rgb(var(--charcoal-600) / <alpha-value>)",
          500: "rgb(var(--charcoal-500) / <alpha-value>)",
        },
        fog: {
          100: "rgb(var(--fog-100) / <alpha-value>)",
          300: "rgb(var(--fog-300) / <alpha-value>)",
          500: "rgb(var(--fog-500) / <alpha-value>)",
          700: "rgb(var(--fog-700) / <alpha-value>)",
        },
        electric: {
          300: "rgb(var(--electric-300) / <alpha-value>)",
          400: "rgb(var(--electric-400) / <alpha-value>)",
          500: "rgb(var(--electric-500) / <alpha-value>)",
          600: "rgb(var(--electric-600) / <alpha-value>)",
          700: "rgb(var(--electric-700) / <alpha-value>)",
        },
        priority: { critical: "#FF4D5E", high: "#FFA33A", medium: "#4C8DFF", low: "#8691A6" },
        status: { done: "#34D399", hold: "#FBBF24", cancelled: "#6B7385" },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(45,107,255,.35), 0 10px 34px -10px rgba(45,107,255,.35)",
        card: "0 12px 34px -20px rgba(0,0,0,.28)",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: { rise: "rise .28s cubic-bezier(.2,.8,.2,1) both", fade: "fade .22s ease-out both" },
    },
  },
  plugins: [],
};
