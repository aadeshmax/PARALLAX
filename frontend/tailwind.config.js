/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          bg: "#060D17",
          panel: "#0B1522",
          elevated: "#111E2E",
          border: "#203247",
          primary: "#F1F5F9",
          secondary: "#94A3B8",
          accent: "#287BFF",
          opera: "#328CFF",
          candidate: "#FFB020",
          permanent: "#14B8A6",
          sar: "#A78BFA",
          boundary: "#E85A9E",
          success: "#2DD4A0",
          error: "#EF4444",
          uncertainty: "#64748B"
        },
        radar: {
          bg: "#060D17",
          card: "#0B1522",
          border: "#203247",
          accent: "#287BFF",
          openwater: "#328CFF",
          vegwater: "#FFB020",
          operawater: "#328CFF",
          gap: "#FFB020",
          darken: "#A78BFA"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace']
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
