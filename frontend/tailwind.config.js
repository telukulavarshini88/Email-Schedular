/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16222E",
        paper: "#F6F7F9",
        line: "#E2E6EB",
        brand: { DEFAULT: "#2A5BD7", dark: "#1F46A8", soft: "#E8EEFC" },
      },
      fontFamily: { sans: ['"Figtree"', "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
