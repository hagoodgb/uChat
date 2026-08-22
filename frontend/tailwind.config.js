/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: "#14161C",
        panel: "#1C1F28",
        panel2: "#22252F",
        hairline: "#2A2E3A",
        ink: "#E8E6E0",
        muted: "#8B8F9C",
        brass: "#C9A15A",
        brassSoft: "#8C7343",
        teal: "#5A9C9C",
        action: "#8983A0",
        speech: "#F2D9A8",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Source Serif 4'", "'Newsreader'", "serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        panel: "0 20px 60px -20px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
