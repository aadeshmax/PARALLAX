/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        radar: {
          bg: "#0b0f19",
          card: "#111827",
          border: "#1f293d",
          accent: "#38bdf8",
          openwater: "#2563eb",
          vegwater: "#10b981",
          operawater: "#06b6d4",
          gap: "#f59e0b",
          darken: "#6366f1"
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
