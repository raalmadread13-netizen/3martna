/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Luxury navy + gold identity
        primary: {
          DEFAULT: '#0F172A',
          light: '#1E293B',
          dark: '#020617',
        },
        gold: {
          DEFAULT: '#C8A24B',
          light: '#E3C983',
          dark: '#9A7B32',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#111827',
        },
        muted: {
          light: '#F1F5F9',
          dark: '#1F2937',
        },
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#2563EB',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
