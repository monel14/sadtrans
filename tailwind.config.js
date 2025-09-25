/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./app.ts",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          600: '#7c3aed',
          700: '#6d28d9'
        }
      }
    },
  },
  plugins: [],
}