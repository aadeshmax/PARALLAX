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
          bg: "#07090E",
          panel: "#0D111A",
          elevated: "#151B28",
          border: "#1E2638",
          primary: "#F8FAFC",
          secondary: "#94A3B8",
          accent: "#2563EB",
          opera: "#00A3FF",
          candidate: "#FFAE19",
          permanent: "#10B981",
          sar: "#8B5CF6",
          boundary: "#F43F5E",
          success: "#10B981",
          error: "#EF4444",
          uncertainty: "#64748B"
        },
        radar: {
          bg: "#07090E",
          card: "#0D111A",
          border: "#1E2638",
          accent: "#2563EB",
          openwater: "#00A3FF",
          vegwater: "#FFAE19",
          operawater: "#00A3FF",
          gap: "#FFAE19",
          darken: "#8B5CF6"
        }
      },
      boxShadow: {
        'glass': '0 20px 40px -15px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'pill': '0 10px 25px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'glow-accent': '0 0 20px -3px rgba(37, 99, 235, 0.5)',
        'glow-amber': '0 0 20px -3px rgba(255, 174, 25, 0.5)',
        'glow-cyan': '0 0 20px -3px rgba(0, 163, 255, 0.5)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace']
      },
      spacing: {
        '88': '22rem',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
