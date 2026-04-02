import type { Config } from 'tailwindcss';

export default {
  content: [
    './entrypoints/**/*.{ts,tsx,html}',
    './components/**/*.{ts,tsx}',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        e3: {
          primary: '#1e3a5f',
          accent: '#4a90d9',
          bg: '#f5f7fa',
          card: '#ffffff',
          danger: '#e74c3c',
          warning: '#f39c12',
          success: '#27ae60',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
