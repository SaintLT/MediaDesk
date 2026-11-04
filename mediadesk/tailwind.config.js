/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // Surfaces: black -> charcoal steps
        ink: "#06070A",
        charcoal: { 950: "#0B0D11", 900: "#10131A", 800: "#161A23", 700: "#1E232F", 600: "#2B3140", 500: "#3A4152" },
        // Text
        fog: { 100: "#EEF1F7", 300: "#C2C9D6", 500: "#8A93A6", 700: "#5C6578" },
        // Brand: electric blue
        electric: { 300: "#7FA6FF", 400: "#5B8CFF", 500: "#2D6BFF", 600: "#1F55E0", 700: "#1A44B5" },
        // Priority (never colour alone: the UI also shows a label and icon)
        priority: { critical: "#FF4D5E", high: "#FFA33A", normal: "#4C8DFF", low: "#8691A6" },
        // Status
        status: { done: "#34D399", hold: "#FBBF24", cancelled: "#6B7385" },
      },
      boxShadow: { glow: "0 0 0 1px rgba(45,107,255,.5), 0 8px 30px -8px rgba(45,107,255,.45)" },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { rise: "rise .22s ease-out both" },
    },
  },
  plugins: [],
};
