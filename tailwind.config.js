/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { 950: '#05070d', 900: '#0a0e1a', 850: '#0d1424', 800: '#111a2e', 700: '#1a2740', 600: '#243450' },
        cyan: { glow: '#22d3ee' },
      },
      fontFamily: { mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] },
      boxShadow: {
        glow: '0 0 24px -4px rgba(34,211,238,0.35)',
        'glow-lg': '0 0 48px -8px rgba(34,211,238,0.45)',
      },
      backgroundImage: {
        'grid-tech': 'linear-gradient(rgba(56,189,248,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.05) 1px, transparent 1px)',
        'radial-glow': 'radial-gradient(circle at 50% 0%, rgba(34,211,238,0.12), transparent 60%)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { 'fade-in': 'fade-in 0.4s ease-out' },
    },
  },
  plugins: [],
};
