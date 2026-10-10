/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // full 0-100 opacity scale so any `/NN` colour modifier is valid in @apply
      opacity: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [i, String(i / 100)])),
      colors: {
        /* ---- Brand: warm orange derived from the Global Store logo ---- */
        brand: {
          50: '#FFF5ED', 100: '#FFE7D4', 200: '#FFC9A8', 300: '#FFA470',
          400: '#FF7C39', 500: '#F26722', 600: '#D9520F', 700: '#B33F0C',
          800: '#8A310C', 900: '#67260C', 950: '#3A1206',
        },
        /* ---- Ink: deep navy/graphite for a trustworthy financial base ---- */
        ink: {
          50: '#F5F7FA', 100: '#E7ECF3', 200: '#C9D3E1', 300: '#9FAEC4',
          400: '#6D809C', 500: '#4C5E7A', 600: '#374862', 700: '#26334A',
          800: '#182338', 900: '#0E1727', 950: '#070D18',
        },
        /* ---- Signal: teal for healthy states, finance-positive ---- */
        signal: {
          50: '#E6FBF7', 100: '#C2F5EC', 200: '#8AEADC', 300: '#4EDDC8',
          400: '#22C7B1', 500: '#0FA898', 600: '#0A877D', 700: '#0C6B65',
          800: '#0E5551', 900: '#104744',
        },
        /* ---- AI: violet reserved exclusively for intelligent features ---- */
        ai: {
          50: '#F2EFFF', 100: '#E5E0FF', 200: '#CEC5FF', 300: '#AE9EFF',
          400: '#8E74FA', 500: '#7C5CFF', 600: '#6139F0', 700: '#4E27C4',
          800: '#40229E', 900: '#35207D',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"IBM Plex Sans Arabic"', 'Inter', 'system-ui', 'sans-serif'],
        ar: ['"IBM Plex Sans Arabic"', '"Tajawal"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.5rem' },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px -8px rgba(16,24,40,.12)',
        lift: '0 2px 4px rgba(16,24,40,.04), 0 18px 40px -12px rgba(16,24,40,.22)',
        glow: '0 0 0 1px rgba(242,103,34,.25), 0 12px 40px -12px rgba(242,103,34,.45)',
      },
      backgroundImage: {
        'brand-mesh': 'radial-gradient(1200px 600px at 10% -10%, rgba(242,103,34,.22), transparent 60%), radial-gradient(900px 500px at 90% 0%, rgba(124,92,255,.18), transparent 55%)',
        'grid-fine':
          'linear-gradient(to right, rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.045) 1px, transparent 1px)',
      },
      backgroundSize: { grid: '44px 44px' },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(242,103,34,.45)' }, '70%': { boxShadow: '0 0 0 12px rgba(242,103,34,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(242,103,34,0)' } },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.2,.8,.2,1) both',
        'fade-in': 'fade-in .4s ease both',
        'pulse-ring': 'pulse-ring 2s infinite',
      },
    },
  },
  plugins: [],
};
