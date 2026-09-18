/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F1F6FB',
          100: '#E8EEF5',
          500: '#1E4570',
          600: '#15365A',
          700: '#0E2A47',
          800: '#0A1B30',
          900: '#081A2F',
        },
        navy: {
          DEFAULT: '#0E2A47',
          50: '#F1F6FB',
          100: '#E8EEF5',
          200: '#D1DEEB',
          600: '#1E4570',
          700: '#15365A',
          800: '#0E2A47',
          850: '#0A1B30',
          900: '#081A2F',
          950: '#061325',
        },
        gold: {
          DEFAULT: '#B88634',
          50: '#FEFAF3',
          100: '#FDF5E8',
          200: '#F6E3C0',
          400: '#C99745',
          500: '#B88634',
          600: '#9A6E26',
        },
        canvas: '#F4F8FC',
        borderline: '#E6ECF2',
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
