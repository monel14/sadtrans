/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./app.ts",
    "./components/**/*.{ts,tsx}",
    "./views/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}",
    "./models/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

