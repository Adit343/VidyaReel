import type { Config } from 'tailwindcss';

// Tokens from the Stitch project "Vidyareel Educator Video Generator" (Solstice Studio / Atelier).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        solstice: {
          sage: '#EEF1EC', forest: '#145A41', forestHover: '#0F4632', saffron: '#FF9F1C', success: '#1A8F5A',
          warning: '#B36B00', critical: '#C93A2E', charcoal: '#0F2A20', slate: '#54675D', border: '#D3DBD0',
          borderHover: '#B9C5B5', chipBg: '#E1E7DF',
        },
        atelier: {
          sand: '#EEF1EC', border: '#D3DBD0', green: '#145A41', dark: '#0F2A20', hover: '#0F4632', muted: '#54675D',
          'border-soft': '#B9C5B5', saffron: '#FF9F1C', 'amber-banner': '#B36B00', 'amber-bg': '#FFF8F0',
          'amber-border': '#F2DFC2', crimson: '#C93A2E',
        },
        'primary-fixed': '#adf1d0', 'primary-fixed-dim': '#92d4b4', 'primary-container': '#145a41',
        'surface-container': '#d6f5e5', 'on-surface': '#052017', outline: '#707973', 'outline-variant': '#bfc9c2',
        secondary: '#506359',
      },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem' },
      fontFamily: {
        display: ['Bricolage Grotesque', 'sans-serif'],
        'body-md': ['Hanken Grotesk', 'sans-serif'],
        'body-sm': ['Hanken Grotesk', 'sans-serif'],
        'ui-medium': ['Hanken Grotesk', 'sans-serif'],
        'ui-regular': ['Hanken Grotesk', 'sans-serif'],
        'headline-lg': ['Bricolage Grotesque', 'sans-serif'],
        'headline-md': ['Bricolage Grotesque', 'sans-serif'],
        'headline-sm': ['Bricolage Grotesque', 'sans-serif'],
        'code-xs': ['Space Mono', 'monospace'],
        'code-sm': ['Space Mono', 'monospace'],
        martian: ['Martian Mono', 'monospace'],
      },
      boxShadow: {
        botanical: '0 12px 32px -8px rgba(20, 90, 65, 0.08)',
        'botanical-card': '0 12px 32px 0 rgba(20, 90, 65, 0.06)',
        elevated: '0 8px 24px -4px rgba(15, 42, 32, 0.06)',
      },
    },
  },
  plugins: [],
};
export default config;
