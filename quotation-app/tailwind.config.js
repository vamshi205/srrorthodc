/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        indigo: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#ced9fd',
          300: '#a1b8fa',
          400: '#708cf5',
          500: '#4a64ed',
          600: '#3443e1',
          700: '#2a34cc',
          800: '#272ca5',
          900: '#252a84',
          950: '#16184d',
        },
      },
    },
  },
  plugins: [],
}
