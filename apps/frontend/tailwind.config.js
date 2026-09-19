/** @type {import('tailwindcss').Config} */
const withAlpha = (name) => `rgb(var(${name}) / <alpha-value>)`;
const sansStack = [
  'var(--font-outfit)',
  'var(--font-inter)',
  'ui-sans-serif',
  'system-ui',
  'sans-serif',
];
const displayStack = ['var(--font-garamond)', 'Georgia', "'Times New Roman'", 'serif'];

module.exports = {
  // MUST be 'class': the app toggles `.dark` on <html> (see ThemeProvider), and the
  // design tokens in globals.css also switch on that class. Leaving this at the default
  // ('media') made every `dark:` utility follow the OS setting while the tokens followed
  // the in-app toggle — so choosing dark on a light OS produced dark-on-dark text.
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand (channel vars so dark mode + opacity modifiers work; light values unchanged)
        primary: withAlpha('--c-primary'),
        'primary-foreground': withAlpha('--c-primary-foreground'),
        secondary: withAlpha('--c-secondary'),
        'secondary-foreground': withAlpha('--c-secondary-foreground'),
        accent: withAlpha('--c-accent'),
        'accent-foreground': withAlpha('--c-accent-foreground'),
        // shadcn-style surface tokens (RGB channels defined in globals.css :root/.dark)
        background: withAlpha('--c-background'),
        foreground: withAlpha('--c-foreground'),
        card: withAlpha('--c-card'),
        'card-foreground': withAlpha('--c-card-foreground'),
        popover: withAlpha('--c-popover'),
        'popover-foreground': withAlpha('--c-popover-foreground'),
        muted: withAlpha('--c-muted'),
        'muted-foreground': withAlpha('--c-muted-foreground'),
        border: withAlpha('--c-border'),
        input: withAlpha('--c-input'),
        ring: withAlpha('--c-ring'),
        destructive: withAlpha('--c-destructive'),
        'destructive-foreground': withAlpha('--c-destructive-foreground'),
        // Builder text tokens (`text-text-primary` etc.)
        'text-primary': withAlpha('--c-text-primary'),
        'text-secondary': withAlpha('--c-text-secondary'),
        'text-muted': withAlpha('--c-text-muted'),
        // Builder surface tokens (`bg-surface-container-low` etc.)
        'surface-container-lowest': withAlpha('--c-surface-container-lowest'),
        'surface-container-low': withAlpha('--c-surface-container-low'),
        'surface-container-high': withAlpha('--c-surface-container-high'),
        'secondary-container': withAlpha('--c-secondary-container'),
        'secondary-fixed': withAlpha('--c-secondary-fixed'),
        // Fixed-alpha treatments (already carry their own alpha; no opacity modifiers used)
        'glass-border': 'var(--color-glass-border)',
        'accent-glow': 'var(--color-accent-glow)',
        'on-primary': '#ffffff',
      },
      fontFamily: {
        sans: sansStack,
        display: displayStack,
        'display-hero': displayStack,
        'headline-lg': displayStack,
        'headline-md': displayStack,
        'stats-number': sansStack,
        'body-md': sansStack,
        'body-lg': sansStack,
        'label-sm': sansStack,
      },
      fontSize: {
        'display-hero': [
          'clamp(2.75rem, 7vw, 5rem)',
          { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' },
        ],
        'headline-md': ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.15' }],
        'body-md': ['1rem', { lineHeight: '1.6' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
      },
      spacing: {
        'margin-mobile': '1rem',
        'margin-desktop': '2.5rem',
      },
      maxWidth: {
        'container-max': '1440px',
      },
    },
  },
  plugins: [],
};
